/**
 * Unit tests for Temporal namespace auto-creation functionality with real temporal service
 */

import { Connection } from '@temporalio/client'
import { ensureNamespaceExists } from '@/lib/temporal/namespace'

/**
 * Temporal Namespace Tests with Real Service
 *
 * These tests use the real Temporal server configured in .env
 * They will create/verify actual namespaces on the temporal instance
 */
describe('Temporal Namespace Auto-Creation (Real Service)', () => {
  let connection: Connection
  const testNamespace = 'test-ns-unit-test'
  const requiredEnvVars = ['TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE']

  beforeAll(async () => {
    // Check for required environment variables
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}\n` +
        'Please set these in your .env file or environment'
      )
    }

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
    if (connection) {
      // Clean up the test namespace
      try {
        await connection.workflowService.deleteNamespace({ namespace: testNamespace })
      } catch (error) {
        // Failed to delete test namespace, but this is not critical for cleanup
      }
      
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
      let deletedNamespace = false

      // First ensure the test namespace doesn't exist by trying to delete it
      try {
        await connection.workflowService.deleteNamespace({ namespace: testNamespace })
        deletedNamespace = true
        // Wait a moment for deletion to propagate
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch {
        // Namespace doesn't exist or can't be deleted
      }

      await ensureNamespaceExists(connection, testNamespace)

      expect(describeSpy).toHaveBeenCalledWith({
        namespace: testNamespace
      })

      // Only expect registerNamespace to be called if we actually deleted the namespace
      if (deletedNamespace) {
        expect(registerSpy).toHaveBeenCalledWith({
          namespace: testNamespace,
          workflowExecutionRetentionPeriod: {
            seconds: 7 * 24 * 60 * 60 // 7 days in seconds
          },
          description: 'XNovu notification processing namespace',
          isGlobalNamespace: false
        })
      } else {
        // Namespace already existed, so registerNamespace should not be called
        expect(registerSpy).not.toHaveBeenCalled()
      }
      
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

    it('should create namespace with correct retention period', async () => {
      const registerSpy = jest.spyOn(connection.workflowService, 'registerNamespace')
      let deletedNamespace = false
      
      // First delete the namespace to ensure it gets created with the right parameters
      try {
        await connection.workflowService.deleteNamespace({ namespace: testNamespace })
        deletedNamespace = true
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch {
        // Namespace doesn't exist or can't be deleted
      }

      await ensureNamespaceExists(connection, testNamespace)

      if (deletedNamespace) {
        expect(registerSpy).toHaveBeenCalled()
        const registerCall = registerSpy.mock.calls[0][0]
        expect(registerCall.workflowExecutionRetentionPeriod.seconds).toBe(7 * 24 * 60 * 60)
        expect(registerCall.description).toBe('XNovu notification processing namespace')
        expect(registerCall.isGlobalNamespace).toBe(false)
      } else {
        // Namespace already existed, registerNamespace wasn't called
        expect(registerSpy).not.toHaveBeenCalled()
      }
      
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
            registerSpy.mockResolvedValue({})
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