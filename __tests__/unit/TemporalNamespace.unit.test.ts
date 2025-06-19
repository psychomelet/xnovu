/**
 * Unit tests for Temporal namespace auto-creation functionality with real temporal service
 */

import { Connection } from '@temporalio/client'
import { ensureNamespaceExists } from '@/lib/temporal/namespace'
import { deleteTemporalNamespace } from '../utils/temporal-namespace-cleanup'

/**
 * Temporal Namespace Tests with Real Service
 *
 * These tests use the real Temporal server configured in .env
 * They will create/verify actual namespaces on the temporal instance
 */
describe('Temporal Namespace Auto-Creation (Real Service)', () => {
  let connection: Connection
  let testNamespace: string
  const requiredEnvVars = ['TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE']
  const createdNamespaces: string[] = []

  beforeAll(async () => {
    // Check for required environment variables
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}\n` +
        'Please set these in your .env file or environment'
      )
    }

    // Use the shared test namespace from global setup
    testNamespace = process.env.TEMPORAL_NAMESPACE!

    // Establish real temporal connection
    const address = process.env.TEMPORAL_ADDRESS!
    const isSecure = address.includes(':443') || address.startsWith('https://')

    connection = await Connection.connect({
      address,
      tls: isSecure ? {} : false,
      connectTimeout: '10s',
    })
  }, 30000)

  afterAll(async () => {
    // Clean up all namespaces created during this test
    for (const namespace of createdNamespaces) {
      await deleteTemporalNamespace(namespace)
    }
    
    if (connection) {
      await connection.close()
    }
  }, 30000)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('ensureNamespaceExists with real temporal service', () => {
    it('should skip creation for default namespace', async () => {
      // Spy on the connection methods to verify they're not called
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      await ensureNamespaceExists(connection, 'default')

      expect(describeSpy).not.toHaveBeenCalled()
      expect(registerSpy).not.toHaveBeenCalled()

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    })

    it('should skip creation for empty namespace', async () => {
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      await ensureNamespaceExists(connection, '')

      expect(describeSpy).not.toHaveBeenCalled()
      expect(registerSpy).not.toHaveBeenCalled()

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    })

    it('should not create namespace when it already exists', async () => {
      // Use the configured namespace from .env which should exist
      const existingNamespace = process.env.TEMPORAL_NAMESPACE!
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      await ensureNamespaceExists(connection, existingNamespace)

      expect(describeSpy).toHaveBeenCalledWith({
        namespace: existingNamespace
      })
      expect(registerSpy).not.toHaveBeenCalled()

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    }, 15000)

    it('should create namespace when it does not exist', async () => {
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      // Use a unique test namespace for this specific test
      const uniqueTestNamespace = `test-ns-create-${Date.now()}`
      createdNamespaces.push(uniqueTestNamespace)

      await ensureNamespaceExists(connection, uniqueTestNamespace)

      expect(describeSpy).toHaveBeenCalledWith({
        namespace: uniqueTestNamespace
      })

      // The namespace should have been created, so registerNamespace must have been invoked.
      // Since uniqueTestNamespace starts with 'test-ns-', it gets test namespace behavior
      expect(registerSpy).toHaveBeenCalledWith({
        namespace: uniqueTestNamespace,
        workflowExecutionRetentionPeriod: {
          seconds: 24 * 60 * 60, // 1 day (test namespace minimum)
        },
        description: 'XNovu test namespace (temporary)',
        isGlobalNamespace: false,
      })

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    }, 20000)

    it('should handle race condition when namespace is created by another process', async () => {
      // This test simulates race condition by mocking the register call to fail with ALREADY_EXISTS
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      // Mock describe to fail (namespace not found)
      const notFoundError = new Error('Namespace not found')
      ;(notFoundError as any).code = 5 // NOT_FOUND
      describeSpy.mockRejectedValue(notFoundError)

      // Mock registration failure (already exists)
      const alreadyExistsError = new Error('Namespace already exists')
      ;(alreadyExistsError as any).code = 6 // ALREADY_EXISTS
      registerSpy.mockRejectedValue(alreadyExistsError)

      // Should not throw error even though registration failed
      await expect(ensureNamespaceExists(connection, 'mock-race-test')).resolves.toBeUndefined()

      expect(describeSpy).toHaveBeenCalled()
      expect(registerSpy).toHaveBeenCalled()

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    }, 15000)

    it('should handle unexpected describe errors', async () => {
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      // Mock unexpected error during describe
      const unexpectedError = new Error('Connection failed')
      ;(unexpectedError as any).code = 14 // UNAVAILABLE
      describeSpy.mockRejectedValue(unexpectedError)

      await expect(ensureNamespaceExists(connection, 'mock-error-test')).rejects.toThrow('Connection failed')

      expect(describeSpy).toHaveBeenCalled()
      expect(registerSpy).not.toHaveBeenCalled()

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    }, 15000)

    it('should handle unexpected registration errors', async () => {
      const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      // Mock describe failure (namespace not found)
      const notFoundError = new Error('Namespace not found')
      ;(notFoundError as any).code = 5 // NOT_FOUND
      describeSpy.mockRejectedValue(notFoundError)

      // Mock unexpected registration error
      const registrationError = new Error('Permission denied')
      ;(registrationError as any).code = 7 // PERMISSION_DENIED
      registerSpy.mockRejectedValue(registrationError)

      await expect(ensureNamespaceExists(connection, 'mock-register-error')).rejects.toThrow('Permission denied')

      expect(describeSpy).toHaveBeenCalled()
      expect(registerSpy).toHaveBeenCalled()

      describeSpy.mockRestore()
      registerSpy.mockRestore()
    }, 15000)

    it('should create test namespace with minimal retention period', async () => {
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      // Use a unique test namespace
      const testNamespace = `test-ns-retention-${Date.now()}`
      createdNamespaces.push(testNamespace)

      await ensureNamespaceExists(connection, testNamespace)

      // Assert that test namespace has minimal retention period and correct description
      expect(registerSpy).toHaveBeenCalled()
      const registerCall = registerSpy.mock.calls[0][0] as any
      expect(registerCall.workflowExecutionRetentionPeriod.seconds).toBe(24 * 60 * 60) // 1 day (minimum)
      expect(registerCall.description).toBe('XNovu test namespace (temporary)')
      expect(registerCall.isGlobalNamespace).toBe(false)

      registerSpy.mockRestore()
    }, 15000)

    it('should create production namespace with retention period', async () => {
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

      // Use a production-style namespace name
      const productionNamespace = `prod-namespace-${Date.now()}`
      createdNamespaces.push(productionNamespace)

      await ensureNamespaceExists(connection, productionNamespace)

      // Assert that production namespace has retention period and correct description
      expect(registerSpy).toHaveBeenCalled()
      const registerCall = registerSpy.mock.calls[0][0] as any
      expect(registerCall.workflowExecutionRetentionPeriod.seconds).toBe(7 * 24 * 60 * 60)
      expect(registerCall.description).toBe('XNovu notification processing namespace')
      expect(registerCall.isGlobalNamespace).toBe(false)

      registerSpy.mockRestore()
    }, 15000)
  })

  describe('error code handling with real service', () => {
    // Test only the most important error scenarios to minimize server load
    const testCases = [
      { code: 5, name: 'NOT_FOUND', shouldThrow: false, shouldCreateNamespace: true },
      { code: 6, name: 'ALREADY_EXISTS', shouldThrow: false, inRegisterNamespace: true },
      { code: 7, name: 'PERMISSION_DENIED', shouldThrow: true },
      { code: 14, name: 'UNAVAILABLE', shouldThrow: true }
    ]

    testCases.forEach(({ code, name, shouldThrow, shouldCreateNamespace, inRegisterNamespace }) => {
      it(`should ${shouldThrow ? 'throw' : 'handle'} ${name} error (code ${code})`, async () => {
        const describeSpy = jest.spyOn(connection.workflowService, 'describeNamespace')
        const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')

        const error = new Error(`${name} error`)
        ;(error as any).code = code

        if (inRegisterNamespace) {
          // Test error in registerNamespace
          const notFoundError = new Error('Not found')
          ;(notFoundError as any).code = 5
          describeSpy.mockRejectedValue(notFoundError)
          registerSpy.mockRejectedValue(error)
        } else {
          // Test error in describeNamespace
          describeSpy.mockRejectedValue(error)
          if (shouldCreateNamespace) {
            registerSpy.mockResolvedValue({} as any)
          }
        }

        if (shouldThrow) {
          await expect(ensureNamespaceExists(connection, `mock-error-${code}`)).rejects.toThrow()
        } else {
          await expect(ensureNamespaceExists(connection, `mock-error-${code}`)).resolves.toBeUndefined()
        }

        describeSpy.mockRestore()
        registerSpy.mockRestore()
      }, 15000)
    })
  })
})