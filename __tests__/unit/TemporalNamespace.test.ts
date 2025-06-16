/**
 * Unit tests for Temporal namespace auto-creation functionality
 */

import { ensureNamespaceExists } from '@/lib/temporal/namespace'

describe('Temporal Namespace Auto-Creation', () => {
  let mockConnection: any
  let mockWorkflowService: any

  beforeEach(() => {
    jest.clearAllMocks()

    mockWorkflowService = {
      describeNamespace: jest.fn(),
      registerNamespace: jest.fn()
    }

    mockConnection = {
      workflowService: mockWorkflowService
    }
  })

  describe('ensureNamespaceExists', () => {
    it('should skip creation for default namespace', async () => {
      await ensureNamespaceExists(mockConnection, 'default')

      expect(mockWorkflowService.describeNamespace).not.toHaveBeenCalled()
      expect(mockWorkflowService.registerNamespace).not.toHaveBeenCalled()
    })

    it('should skip creation for empty namespace', async () => {
      await ensureNamespaceExists(mockConnection, '')

      expect(mockWorkflowService.describeNamespace).not.toHaveBeenCalled()
      expect(mockWorkflowService.registerNamespace).not.toHaveBeenCalled()
    })

    it('should not create namespace when it already exists', async () => {
      // Mock successful describe (namespace exists)
      mockWorkflowService.describeNamespace.mockResolvedValue({
        namespaceInfo: { name: 'xnovu-testing' }
      })

      await ensureNamespaceExists(mockConnection, 'xnovu-testing')

      expect(mockWorkflowService.describeNamespace).toHaveBeenCalledWith({
        namespace: 'xnovu-testing'
      })
      expect(mockWorkflowService.registerNamespace).not.toHaveBeenCalled()
    })

    it('should create namespace when it does not exist', async () => {
      // Mock describe failure (namespace not found)
      const notFoundError = new Error('Namespace not found')
      notFoundError.code = 5 // NOT_FOUND
      mockWorkflowService.describeNamespace.mockRejectedValue(notFoundError)

      // Mock successful registration
      mockWorkflowService.registerNamespace.mockResolvedValue({})

      await ensureNamespaceExists(mockConnection, 'xnovu-testing')

      expect(mockWorkflowService.describeNamespace).toHaveBeenCalledWith({
        namespace: 'xnovu-testing'
      })

      expect(mockWorkflowService.registerNamespace).toHaveBeenCalledWith({
        namespace: 'xnovu-testing',
        workflowExecutionRetentionPeriod: {
          seconds: 7 * 24 * 60 * 60 // 7 days in seconds
        },
        description: 'XNovu notification processing namespace',
        isGlobalNamespace: false
      })
    })

    it('should handle race condition when namespace is created by another process', async () => {
      // Mock describe failure (namespace not found)
      const notFoundError = new Error('Namespace not found')
      notFoundError.code = 5 // NOT_FOUND
      mockWorkflowService.describeNamespace.mockRejectedValue(notFoundError)

      // Mock registration failure (already exists)
      const alreadyExistsError = new Error('Namespace already exists')
      alreadyExistsError.code = 6 // ALREADY_EXISTS
      mockWorkflowService.registerNamespace.mockRejectedValue(alreadyExistsError)

      // Should not throw error even though registration failed
      await expect(ensureNamespaceExists(mockConnection, 'xnovu-testing')).resolves.toBeUndefined()

      expect(mockWorkflowService.describeNamespace).toHaveBeenCalled()
      expect(mockWorkflowService.registerNamespace).toHaveBeenCalled()
    })

    it('should handle unexpected describe errors', async () => {
      // Mock unexpected error during describe
      const unexpectedError = new Error('Connection failed')
      unexpectedError.code = 14 // UNAVAILABLE
      mockWorkflowService.describeNamespace.mockRejectedValue(unexpectedError)

      await expect(ensureNamespaceExists(mockConnection, 'xnovu-testing')).rejects.toThrow('Connection failed')

      expect(mockWorkflowService.describeNamespace).toHaveBeenCalled()
      expect(mockWorkflowService.registerNamespace).not.toHaveBeenCalled()
    })

    it('should handle unexpected registration errors', async () => {
      // Mock describe failure (namespace not found)
      const notFoundError = new Error('Namespace not found')
      notFoundError.code = 5 // NOT_FOUND
      mockWorkflowService.describeNamespace.mockRejectedValue(notFoundError)

      // Mock unexpected registration error
      const registrationError = new Error('Permission denied')
      registrationError.code = 7 // PERMISSION_DENIED
      mockWorkflowService.registerNamespace.mockRejectedValue(registrationError)

      await expect(ensureNamespaceExists(mockConnection, 'xnovu-testing')).rejects.toThrow('Permission denied')

      expect(mockWorkflowService.describeNamespace).toHaveBeenCalled()
      expect(mockWorkflowService.registerNamespace).toHaveBeenCalled()
    })

    it('should create namespace with correct retention period', async () => {
      const notFoundError = new Error('Namespace not found')
      notFoundError.code = 5
      mockWorkflowService.describeNamespace.mockRejectedValue(notFoundError)
      mockWorkflowService.registerNamespace.mockResolvedValue({})

      await ensureNamespaceExists(mockConnection, 'test-namespace')

      const registerCall = mockWorkflowService.registerNamespace.mock.calls[0][0]
      expect(registerCall.workflowExecutionRetentionPeriod.seconds).toBe(7 * 24 * 60 * 60)
      expect(registerCall.description).toBe('XNovu notification processing namespace')
      expect(registerCall.isGlobalNamespace).toBe(false)
    })

    it('should work with different namespace names', async () => {
      const testNamespaces = ['xnovu-prod', 'xnovu-staging', 'xnovu-dev']

      for (const namespace of testNamespaces) {
        // Reset mocks for each iteration
        mockWorkflowService.describeNamespace.mockClear()
        mockWorkflowService.registerNamespace.mockClear()

        // Mock namespace doesn't exist
        const notFoundError = new Error('Namespace not found')
        notFoundError.code = 5
        mockWorkflowService.describeNamespace.mockRejectedValue(notFoundError)
        mockWorkflowService.registerNamespace.mockResolvedValue({})

        await ensureNamespaceExists(mockConnection, namespace)

        expect(mockWorkflowService.describeNamespace).toHaveBeenCalledWith({
          namespace
        })
        expect(mockWorkflowService.registerNamespace).toHaveBeenCalledWith(
          expect.objectContaining({ namespace })
        )
      }
    })
  })

  describe('error code handling', () => {
    const testCases = [
      { code: 1, name: 'CANCELLED', shouldThrow: true },
      { code: 2, name: 'UNKNOWN', shouldThrow: true },
      { code: 3, name: 'INVALID_ARGUMENT', shouldThrow: true },
      { code: 4, name: 'DEADLINE_EXCEEDED', shouldThrow: true },
      { code: 5, name: 'NOT_FOUND', shouldThrow: false, shouldCreateNamespace: true },
      { code: 6, name: 'ALREADY_EXISTS', shouldThrow: false, inRegisterNamespace: true },
      { code: 7, name: 'PERMISSION_DENIED', shouldThrow: true },
      { code: 8, name: 'RESOURCE_EXHAUSTED', shouldThrow: true },
      { code: 9, name: 'FAILED_PRECONDITION', shouldThrow: true },
      { code: 10, name: 'ABORTED', shouldThrow: true },
      { code: 11, name: 'OUT_OF_RANGE', shouldThrow: true },
      { code: 12, name: 'UNIMPLEMENTED', shouldThrow: true },
      { code: 13, name: 'INTERNAL', shouldThrow: true },
      { code: 14, name: 'UNAVAILABLE', shouldThrow: true },
      { code: 15, name: 'DATA_LOSS', shouldThrow: true },
      { code: 16, name: 'UNAUTHENTICATED', shouldThrow: true }
    ]

    testCases.forEach(({ code, name, shouldThrow, shouldCreateNamespace, inRegisterNamespace }) => {
      it(`should ${shouldThrow ? 'throw' : 'handle'} ${name} error (code ${code})`, async () => {
        const error = new Error(`${name} error`)
        error.code = code

        if (inRegisterNamespace) {
          // Test error in registerNamespace
          const notFoundError = new Error('Not found')
          notFoundError.code = 5
          mockWorkflowService.describeNamespace.mockRejectedValue(notFoundError)
          mockWorkflowService.registerNamespace.mockRejectedValue(error)
        } else {
          // Test error in describeNamespace
          mockWorkflowService.describeNamespace.mockRejectedValue(error)
          if (shouldCreateNamespace) {
            mockWorkflowService.registerNamespace.mockResolvedValue({})
          }
        }

        if (shouldThrow && !inRegisterNamespace) {
          await expect(ensureNamespaceExists(mockConnection, 'test-namespace')).rejects.toThrow()
        } else if (shouldThrow && inRegisterNamespace) {
          await expect(ensureNamespaceExists(mockConnection, 'test-namespace')).rejects.toThrow()
        } else {
          await expect(ensureNamespaceExists(mockConnection, 'test-namespace')).resolves.toBeUndefined()
        }
      })
    })
  })
})