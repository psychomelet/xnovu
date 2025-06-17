import { RulePollingLoop } from '@/lib/polling/rule-polling-loop'
import { RuleService } from '@/app/services/database/RuleService'
import { RuleSyncService } from '@/lib/temporal/services/rule-sync-service'
import { logger } from '@/app/services/logger'
import type { NotificationRule } from '@/types/rule-engine'

jest.mock('@/app/services/database/RuleService')
jest.mock('@/lib/temporal/services/rule-sync-service')
jest.mock('@/app/services/logger')

describe('RulePollingLoop', () => {
  let pollingLoop: RulePollingLoop
  let mockRuleService: jest.Mocked<RuleService>
  let mockRuleSyncService: jest.Mocked<RuleSyncService>
  
  const config = {
    pollIntervalMs: 1000,
    batchSize: 10,
  }
  
  const mockRules: NotificationRule[] = [
    {
      id: 1,
      name: 'Rule 1',
      enterprise_id: 'ent-1',
      business_id: null,
      notification_workflow_id: 100,
      trigger_type: 'CRON',
      trigger_config: { cron: '0 9 * * MON' },
      rule_payload: { recipients: ['user-1'] },
      publish_status: 'PUBLISH',
      deactivated: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      created_by: null,
      updated_by: null,
      description: null,
      repr: null,
    },
    {
      id: 2,
      name: 'Rule 2',
      enterprise_id: 'ent-2',
      business_id: null,
      notification_workflow_id: 200,
      trigger_type: 'CRON',
      trigger_config: { cron: '0 10 * * TUE' },
      rule_payload: { recipients: ['user-2'] },
      publish_status: 'PUBLISH',
      deactivated: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      created_by: null,
      updated_by: null,
      description: null,
      repr: null,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    
    mockRuleService = {
      getActiveCronRules: jest.fn(),
      getRulesUpdatedAfter: jest.fn(),
      getLastRuleUpdateTime: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<RuleService>
    
    mockRuleSyncService = {
      syncAllRules: jest.fn(),
      syncRule: jest.fn(),
      reconcileSchedules: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<RuleSyncService>
    
    jest.mocked(RuleService).mockImplementation(() => mockRuleService)
    jest.mocked(RuleSyncService).mockImplementation(() => mockRuleSyncService)
    
    pollingLoop = new RulePollingLoop(config)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('start', () => {
    it('should perform initial sync and start polling', async () => {
      mockRuleSyncService.syncAllRules.mockResolvedValue()
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue([])
      
      await pollingLoop.start()
      
      expect(pollingLoop.getIsRunning()).toBe(true)
      expect(logger.info).toHaveBeenCalledWith(
        'Starting rule polling loop',
        { config }
      )
      expect(logger.info).toHaveBeenCalledWith('Performing initial rule sync')
      expect(mockRuleSyncService.syncAllRules).toHaveBeenCalled()
      
      // Fast-forward past initial delay
      jest.advanceTimersByTime(5000)
      
      // Verify polling started
      expect(mockRuleService.getRulesUpdatedAfter).toHaveBeenCalled()
    })

    it('should continue polling even if initial sync fails', async () => {
      mockRuleSyncService.syncAllRules.mockRejectedValue(
        new Error('Initial sync failed')
      )
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue([])
      
      await pollingLoop.start()
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to perform initial rule sync',
        { error: 'Initial sync failed' }
      )
      expect(pollingLoop.getIsRunning()).toBe(true)
    })

    it('should not start if already running', async () => {
      mockRuleSyncService.syncAllRules.mockResolvedValue()
      
      await pollingLoop.start()
      await pollingLoop.start()
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Rule polling loop is already running'
      )
      expect(mockRuleSyncService.syncAllRules).toHaveBeenCalledTimes(1)
    })
  })

  describe('polling', () => {
    beforeEach(async () => {
      mockRuleSyncService.syncAllRules.mockResolvedValue()
      mockRuleSyncService.syncRule.mockResolvedValue()
      await pollingLoop.start()
    })

    it('should poll for updated rules', async () => {
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue(mockRules)
      
      // Fast-forward past initial delay
      jest.advanceTimersByTime(5000)
      await Promise.resolve() // Let promises resolve
      
      expect(mockRuleService.getRulesUpdatedAfter).toHaveBeenCalledWith(
        expect.any(Date),
        config.batchSize
      )
      
      // Verify each rule was synced
      await jest.runAllTimersAsync()
      
      expect(mockRuleSyncService.syncRule).toHaveBeenCalledWith(mockRules[0])
      expect(mockRuleSyncService.syncRule).toHaveBeenCalledWith(mockRules[1])
      expect(logger.info).toHaveBeenCalledWith(
        'Found updated rules to sync',
        {
          count: 2,
          lastPollTime: expect.any(String),
        }
      )
    })

    it('should get last update time from database if not set', async () => {
      const lastUpdateTime = new Date('2024-01-01T00:00:00Z')
      mockRuleService.getLastRuleUpdateTime.mockResolvedValue(lastUpdateTime)
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue([])
      
      // Clear the last poll time that was set during start
      ;(pollingLoop as any).lastPollTime = null
      
      // Fast-forward to trigger poll
      jest.advanceTimersByTime(5000)
      await jest.runAllTimersAsync()
      
      expect(mockRuleService.getLastRuleUpdateTime).toHaveBeenCalled()
      expect(mockRuleService.getRulesUpdatedAfter).toHaveBeenCalledWith(
        lastUpdateTime,
        config.batchSize
      )
    })

    it('should use default time if no last update time', async () => {
      mockRuleService.getLastRuleUpdateTime.mockResolvedValue(null)
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue([])
      
      // Clear the last poll time
      ;(pollingLoop as any).lastPollTime = null
      
      // Fast-forward to trigger poll
      jest.advanceTimersByTime(5000)
      await jest.runAllTimersAsync()
      
      const callArgs = mockRuleService.getRulesUpdatedAfter.mock.calls[0]
      const timeDiff = Date.now() - callArgs[0].getTime()
      
      // Should be roughly 24 hours ago
      expect(timeDiff).toBeGreaterThan(23 * 60 * 60 * 1000)
      expect(timeDiff).toBeLessThan(25 * 60 * 60 * 1000)
    })

    it('should handle polling errors gracefully', async () => {
      mockRuleService.getRulesUpdatedAfter.mockRejectedValue(
        new Error('Database error')
      )
      
      // Fast-forward to trigger poll
      jest.advanceTimersByTime(5000)
      await jest.runAllTimersAsync()
      
      expect(logger.error).toHaveBeenCalledWith(
        'Error in rule polling',
        { error: 'Database error' }
      )
      
      // Should continue polling
      expect(pollingLoop.getIsRunning()).toBe(true)
    })

    it('should handle sync errors for individual rules', async () => {
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue([mockRules[0]])
      mockRuleSyncService.syncRule.mockRejectedValue(new Error('Sync failed'))
      
      // Fast-forward to trigger poll
      jest.advanceTimersByTime(5000)
      await jest.runAllTimersAsync()
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to sync rule',
        { ruleId: 1, error: 'Sync failed' }
      )
    })

    it('should update last poll time after processing rules', async () => {
      mockRuleService.getRulesUpdatedAfter.mockResolvedValue(mockRules)
      
      const initialPollTime = (pollingLoop as any).lastPollTime
      
      // Fast-forward to trigger poll
      jest.advanceTimersByTime(5000)
      await jest.runAllTimersAsync()
      
      const newPollTime = (pollingLoop as any).lastPollTime
      
      // Should update to the latest rule's update time
      expect(newPollTime).toEqual(new Date(mockRules[1].updated_at))
      expect(newPollTime).not.toEqual(initialPollTime)
    })
  })

  describe('stop', () => {
    it('should stop polling and cleanup', async () => {
      mockRuleSyncService.syncAllRules.mockResolvedValue()
      
      await pollingLoop.start()
      expect(pollingLoop.getIsRunning()).toBe(true)
      
      await pollingLoop.stop()
      
      expect(pollingLoop.getIsRunning()).toBe(false)
      expect(logger.info).toHaveBeenCalledWith('Stopping rule polling loop')
      expect(mockRuleSyncService.shutdown).toHaveBeenCalled()
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })

    it('should do nothing if not running', async () => {
      await pollingLoop.stop()
      
      expect(logger.info).not.toHaveBeenCalledWith('Stopping rule polling loop')
      expect(mockRuleSyncService.shutdown).not.toHaveBeenCalled()
    })
  })

  describe('forceReconciliation', () => {
    it('should reconcile schedules when running', async () => {
      mockRuleSyncService.syncAllRules.mockResolvedValue()
      mockRuleSyncService.reconcileSchedules.mockResolvedValue({
        created: 1,
        updated: 2,
        deleted: 1,
        errors: 0,
      })
      
      await pollingLoop.start()
      await pollingLoop.forceReconciliation()
      
      expect(logger.info).toHaveBeenCalledWith('Forcing rule reconciliation')
      expect(mockRuleSyncService.reconcileSchedules).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        'Rule reconciliation complete',
        { created: 1, updated: 2, deleted: 1, errors: 0 }
      )
    })

    it('should warn if not running', async () => {
      await pollingLoop.forceReconciliation()
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Cannot reconcile rules - polling loop is not running'
      )
      expect(mockRuleSyncService.reconcileSchedules).not.toHaveBeenCalled()
    })

    it('should handle reconciliation errors', async () => {
      mockRuleSyncService.syncAllRules.mockResolvedValue()
      mockRuleSyncService.reconcileSchedules.mockRejectedValue(
        new Error('Reconciliation failed')
      )
      
      await pollingLoop.start()
      await pollingLoop.forceReconciliation()
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to reconcile rules',
        { error: 'Reconciliation failed' }
      )
    })
  })
})