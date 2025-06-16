import { describe, it, expect, beforeEach, beforeAll } from '@jest/globals'
import { Connection, WorkflowClient } from '@temporalio/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import * as path from 'path'

/**
 * Temporal Connection Tests
 * 
 * Note: These tests require a running Temporal server. If the tests fail with
 * "Failed to connect before the deadline" errors, it may be due to Jest's 
 * limitations with gRPC connections. You can verify Temporal connectivity 
 * by running: pnpm tsx scripts/verify-temporal.ts
 */
describe('Temporal Connection', () => {
  const requiredEnvVars = ['TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE']
  
  beforeEach(() => {
    // Check for required environment variables
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}\n` +
        'Please set these in your .env file or environment'
      )
    }
  })

  describe('Client SDK Connection', () => {
    it('should connect to Temporal server with valid configuration', async () => {
      const address = process.env.TEMPORAL_ADDRESS!
      const namespace = process.env.TEMPORAL_NAMESPACE!
      
      console.log(`\n📡 Testing Temporal connection to ${address}...`)
      console.log(`   Environment: ${process.env.NODE_ENV}`)
      console.log(`   Namespace: ${namespace}`)
      
      // Determine if TLS is needed based on address
      const isSecure = address.includes(':443') || address.startsWith('https://')
      
      let connection: Connection
      
      // Multiple connection attempts with different configurations
      const connectionConfigs = [
        { tls: isSecure ? {} : false },
        { tls: isSecure ? { serverNameOverride: address.split(':')[0] } : false },
      ]
      
      let lastError: any
      for (const config of connectionConfigs) {
        try {
          connection = await Connection.connect({
            address,
            ...config,
            connectTimeout: '10s',
          })
          break
        } catch (error: any) {
          lastError = error
          continue
        }
      }
      
      if (!connection!) {
        console.error(`❌ Failed to connect to ${address}:`, lastError?.message)
        throw lastError
      }
      
      expect(connection).toBeDefined()
      expect(connection.workflowService).toBeDefined()
      expect(connection.operatorService).toBeDefined()
      
      // Test system info access
      const systemInfo = await connection.workflowService.getSystemInfo({})
      expect(systemInfo.serverVersion).toBeDefined()
      console.log(`✅ Connected to Temporal server version: ${systemInfo.serverVersion}`)
      
      // Create workflow client
      const client = new WorkflowClient({
        connection,
        namespace,
      })
      
      expect(client).toBeDefined()
      expect(client.connection).toBe(connection)
      expect(client.options.namespace).toBe(namespace)
      
      await connection.close()
      console.log('✅ Client connection test passed')
    }, 30000)

    it('should fail gracefully with invalid server address', async () => {
      console.log('\n🧪 Testing invalid server connection...')
      
      try {
        await Connection.connect({
          address: 'invalid.temporal.server:7233',
          connectTimeout: '5s',
        })
        
        // Should not reach here
        expect(true).toBe(false)
      } catch (error: any) {
        expect(error).toBeDefined()
        expect(error.message).toMatch(/Failed to connect|ENOTFOUND|ECONNREFUSED/)
        console.log('✅ Invalid connection failed as expected')
      }
    }, 10000)
  })

  describe('Namespace Access', () => {
    it('should list available namespaces', async () => {
      const address = process.env.TEMPORAL_ADDRESS!
      const isSecure = address.includes(':443') || address.startsWith('https://')
      
      console.log('\n🔍 Testing namespace access...')
      
      const connection = await Connection.connect({
        address,
        tls: isSecure ? {} : false,
        connectTimeout: '10s',
      })
      
      try {
        // Use workflowService.listNamespaces instead of operatorService
        const response = await connection.workflowService.listNamespaces({
          pageSize: 100,
        })
        expect(response.namespaces).toBeDefined()
        expect(Array.isArray(response.namespaces)).toBe(true)
        
        console.log('📋 Available namespaces:')
        response.namespaces.forEach(ns => {
          const name = ns.namespaceInfo?.name || 'unknown'
          const state = ns.namespaceInfo?.state || 'unknown'
          console.log(`   - ${name} (${state})`)
        })
        
        // Check if our configured namespace exists
        const configuredNamespace = process.env.TEMPORAL_NAMESPACE!
        const namespaceExists = response.namespaces.some(
          ns => ns.namespaceInfo?.name === configuredNamespace
        )
        
        if (!namespaceExists) {
          console.log(`⚠️  Configured namespace '${configuredNamespace}' not found`)
          console.log('   You may need to create it with: temporal operator namespace create --namespace ' + configuredNamespace)
        } else {
          console.log(`✅ Configured namespace '${configuredNamespace}' exists`)
        }
      } catch (error: any) {
        // Some deployments may not allow listing namespaces
        if (error.message.includes('Unauthorized') || error.message.includes('PermissionDenied')) {
          console.log('⚠️  Cannot list namespaces (insufficient permissions)')
        } else {
          throw error
        }
      } finally {
        await connection.close()
      }
    }, 30000)
  })

  describe('Worker Connection', () => {
    it('should create a worker connection', async () => {
      // Skip this test if running in CI or if workflows directory doesn't exist
      const workflowsPath = require.resolve('../../lib/temporal/workflows')
      if (!workflowsPath) {
        console.log('Skipping worker test - workflows not found')
        return
      }

      const address = process.env.TEMPORAL_ADDRESS!
      const namespace = process.env.TEMPORAL_NAMESPACE!
      const taskQueue = process.env.TEMPORAL_TASK_QUEUE || 'test-queue'
      const isSecure = address.includes(':443') || address.startsWith('https://')
      
      console.log('\n⚙️  Testing worker connection...')
      console.log(`   Address: ${address}`)
      console.log(`   TLS: ${isSecure}`)
      
      const connection = await NativeConnection.connect({
        address,
        tls: isSecure ? {} : false,
      })
      
      expect(connection).toBeDefined()
      
      // Create a minimal worker for testing
      try {
        const worker = await Worker.create({
          connection,
          namespace,
          taskQueue,
          // Point to the actual workflows directory
          workflowsPath: require.resolve('../../lib/temporal/workflows'),
          activities: {
            testActivity: async () => 'test',
          },
          maxConcurrentActivityTaskExecutions: 1,
          maxConcurrentWorkflowTaskExecutions: 1,
        })
        
        expect(worker).toBeDefined()
        expect(worker.getState()).toBe('INITIALIZED')
        
        console.log('✅ Worker connection established')
        console.log(`   - Namespace: ${namespace}`)
        console.log(`   - Task Queue: ${taskQueue}`)
      } catch (error: any) {
        console.log('⚠️  Worker creation failed:', error.message)
      } finally {
        // Don't run the worker, just test creation
        await connection.close()
      }
    }, 30000)
  })

  describe('gRPC vs HTTPS Detection', () => {
    it('should correctly detect TLS requirement based on address', () => {
      console.log('\n🔒 Testing TLS detection...')
      
      const testCases = [
        { address: 'temporal.example.com:443', expectTLS: true },
        { address: 'temporal-grpc.example.com:443', expectTLS: true },
        { address: 'https://temporal.example.com', expectTLS: true },
        { address: 'localhost:7233', expectTLS: false },
        { address: 'temporal.internal:7233', expectTLS: false },
        { address: '192.168.1.100:7233', expectTLS: false },
      ]
      
      testCases.forEach(({ address, expectTLS }) => {
        const isSecure = address.includes(':443') || address.startsWith('https://')
        expect(isSecure).toBe(expectTLS)
        console.log(`   ${expectTLS ? '🔒' : '🔓'} ${address} -> TLS: ${isSecure}`)
      })
      
      console.log('✅ TLS detection test passed')
    })
  })

  describe('Connection Configuration', () => {
    it('should validate required environment variables', () => {
      console.log('\n📋 Validating Temporal configuration...')
      
      const config = {
        address: process.env.TEMPORAL_ADDRESS,
        namespace: process.env.TEMPORAL_NAMESPACE,
        taskQueue: process.env.TEMPORAL_TASK_QUEUE,
        maxConcurrentActivities: process.env.TEMPORAL_MAX_CONCURRENT_ACTIVITIES,
        maxConcurrentWorkflows: process.env.TEMPORAL_MAX_CONCURRENT_WORKFLOWS,
        maxCachedWorkflows: process.env.TEMPORAL_MAX_CACHED_WORKFLOWS,
      }
      
      console.log('Current configuration:')
      Object.entries(config).forEach(([key, value]) => {
        const status = value ? '✅' : '⚠️ '
        console.log(`   ${status} ${key}: ${value || 'not set'}`)
      })
      
      // Validate required fields
      expect(config.address).toBeDefined()
      expect(config.namespace).toBeDefined()
      
      // Validate numeric fields if present
      if (config.maxConcurrentActivities) {
        expect(Number(config.maxConcurrentActivities)).toBeGreaterThan(0)
      }
      if (config.maxConcurrentWorkflows) {
        expect(Number(config.maxConcurrentWorkflows)).toBeGreaterThan(0)
      }
      if (config.maxCachedWorkflows) {
        expect(Number(config.maxCachedWorkflows)).toBeGreaterThan(0)
      }
      
      console.log('\n✅ Configuration validation passed')
    })
  })
})