import { RuleSyncService } from '@/lib/temporal/services/rule-sync-service'
import { RuleService } from '@/app/services/database/RuleService'
import { logger } from '@/app/services/logger'
import * as scheduleClient from '@/lib/temporal/client/schedule-client'
import type { NotificationRule } from '@/types/rule-engine'

jest.mock('@/app/services/database/RuleService')
jest.mock('@/app/services/logger')
jest.mock('@/lib/temporal/client/schedule-client')

describe('RuleSyncService', () => {
  let service: RuleSyncService
  let mockRuleService: jest.Mocked<RuleService>
  
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
      updated_at: '2024-01-01T00:00:00Z',
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
      updated_at: '2024-01-01T00:00:00Z',
      created_by: null,
      updated_by: null,
      description: null,
      repr: null,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockRuleService = {
      getActiveCronRules: jest.fn(),
      getRule: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<RuleService>
    
    jest.mocked(RuleService).mockImplementation(() => mockRuleService)
    
    service = new RuleSyncService()
  })

  describe('syncAllRules', () => {
    it('should sync all active rules on startup', async () => {
      mockRuleService.getActiveCronRules.mockResolvedValue(mockRules)
      jest.spyOn(scheduleClient, 'listSchedules').mockResolvedValue([
        { id: 'rule-1-ent-1', description: {} as any },
        { id: 'rule-999-ent-999', description: {} as any }, // Orphaned schedule
      ])
      jest.spyOn(scheduleClient, 'updateSchedule').mockResolvedValue()
      jest.spyOn(scheduleClient, 'createSchedule').mockResolvedValue({} as any)
      jest.spyOn(scheduleClient, 'deleteSchedule').mockResolvedValue()
      
      await service.syncAllRules()
      
      expect(mockRuleService.getActiveCronRules).toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith(
        'Found 2 active CRON rules to sync'
      )
      
      // Should update existing schedule for rule 1
      expect(scheduleClient.updateSchedule).toHaveBeenCalledWith(mockRules[0])
      
      // Should create new schedule for rule 2
      expect(scheduleClient.createSchedule).toHaveBeenCalledWith(mockRules[1])
      
      // Should delete orphaned schedule
      expect(scheduleClient.deleteSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 999,
          enterprise_id: 'ent-999',
        })
      )
    })

    it('should handle sync errors gracefully', async () => {
      mockRuleService.getActiveCronRules.mockResolvedValue([mockRules[0]])
      jest.spyOn(scheduleClient, 'listSchedules').mockResolvedValue([])
      jest.spyOn(scheduleClient, 'createSchedule').mockRejectedValue(
        new Error('Create failed')
      )
      
      await service.syncAllRules()
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to sync rule',
        {
          ruleId: 1,
          error: 'Create failed',
        }
      )
      
      // Should still complete sync process
      expect(logger.info).toHaveBeenCalledWith(
        'Completed full rule sync with Temporal schedules'
      )
    })

    it('should handle database errors', async () => {
      mockRuleService.getActiveCronRules.mockRejectedValue(
        new Error('Database error')
      )
      
      await expect(service.syncAllRules()).rejects.toThrow('Database error')
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to sync all rules',
        { error: 'Database error' }
      )
    })
  })

  describe('syncRule', () => {
    it('should create or update schedule for active CRON rule', async () => {
      jest.spyOn(scheduleClient, 'updateSchedule').mockResolvedValue()
      
      await service.syncRule(mockRules[0])
      
      expect(scheduleClient.updateSchedule).toHaveBeenCalledWith(mockRules[0])
      expect(logger.info).toHaveBeenCalledWith(
        'Synced rule with Temporal',
        { ruleId: 1, action: 'create_or_update' }
      )
    })

    it('should skip non-CRON rules', async () => {
      const nonCronRule = { ...mockRules[0], trigger_type: 'EVENT' }
      
      await service.syncRule(nonCronRule)
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Skipping non-CRON rule',
        { ruleId: 1, triggerType: 'EVENT' }
      )
      expect(scheduleClient.updateSchedule).not.toHaveBeenCalled()
    })

    it('should remove schedule for deactivated rule', async () => {
      const deactivatedRule = { ...mockRules[0], deactivated: true }
      jest.spyOn(scheduleClient, 'deleteSchedule').mockResolvedValue()
      
      await service.syncRule(deactivatedRule)
      
      expect(scheduleClient.deleteSchedule).toHaveBeenCalledWith(deactivatedRule)
      expect(logger.info).toHaveBeenCalledWith(
        'Removed schedule for inactive rule',
        { ruleId: 1 }
      )
    })

    it('should remove schedule for unpublished rule', async () => {
      const unpublishedRule = { ...mockRules[0], publish_status: 'DRAFT' }
      jest.spyOn(scheduleClient, 'deleteSchedule').mockResolvedValue()
      
      await service.syncRule(unpublishedRule)
      
      expect(scheduleClient.deleteSchedule).toHaveBeenCalledWith(unpublishedRule)
    })

    it('should remove schedule for rule without trigger config', async () => {
      const invalidRule = { ...mockRules[0], trigger_config: null }
      jest.spyOn(scheduleClient, 'deleteSchedule').mockResolvedValue()
      
      await service.syncRule(invalidRule)
      
      expect(scheduleClient.deleteSchedule).toHaveBeenCalledWith(invalidRule)
    })

    it('should handle sync errors', async () => {
      jest.spyOn(scheduleClient, 'updateSchedule').mockRejectedValue(
        new Error('Update failed')
      )
      
      await expect(service.syncRule(mockRules[0])).rejects.toThrow('Update failed')
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to sync rule',
        { ruleId: 1, error: 'Update failed' }
      )
    })
  })

  describe('removeSchedule', () => {
    it('should delete schedule', async () => {
      jest.spyOn(scheduleClient, 'deleteSchedule').mockResolvedValue()
      
      await service.removeSchedule(mockRules[0])
      
      expect(scheduleClient.deleteSchedule).toHaveBeenCalledWith(mockRules[0])
      expect(logger.info).toHaveBeenCalledWith(
        'Deleted schedule for rule',
        { ruleId: 1 }
      )
    })

    it('should handle deletion errors', async () => {
      jest.spyOn(scheduleClient, 'deleteSchedule').mockRejectedValue(
        new Error('Delete failed')
      )
      
      await expect(service.removeSchedule(mockRules[0])).rejects.toThrow(
        'Delete failed'
      )
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete schedule',
        { ruleId: 1, error: 'Delete failed' }
      )
    })
  })

  describe('reconcileSchedules', () => {
    it('should reconcile schedules and return stats', async () => {
      mockRuleService.getActiveCronRules.mockResolvedValue(mockRules)
      jest.spyOn(scheduleClient, 'listSchedules').mockResolvedValue([
        { id: 'rule-1-ent-1', description: {} as any },
        { id: 'rule-999-ent-999', description: {} as any },
      ])
      jest.spyOn(scheduleClient, 'updateSchedule').mockResolvedValue()
      jest.spyOn(scheduleClient, 'createSchedule').mockResolvedValue({} as any)
      jest.spyOn(scheduleClient, 'deleteSchedule').mockResolvedValue()
      
      const stats = await service.reconcileSchedules()
      
      expect(stats).toEqual({
        created: 1,
        updated: 1,
        deleted: 1,
        errors: 0,
      })
      
      expect(logger.info).toHaveBeenCalledWith('Reconciliation complete', stats)
    })

    it('should track errors in stats', async () => {
      mockRuleService.getActiveCronRules.mockResolvedValue([mockRules[0]])
      jest.spyOn(scheduleClient, 'listSchedules').mockResolvedValue([])
      jest.spyOn(scheduleClient, 'createSchedule').mockRejectedValue(
        new Error('Create failed')
      )
      
      const stats = await service.reconcileSchedules()
      
      expect(stats).toEqual({
        created: 0,
        updated: 0,
        deleted: 0,
        errors: 1,
      })
    })

    it('should handle reconciliation errors', async () => {
      mockRuleService.getActiveCronRules.mockRejectedValue(
        new Error('Database error')
      )
      
      await expect(service.reconcileSchedules()).rejects.toThrow('Database error')
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to reconcile schedules',
        { error: 'Database error' }
      )
    })
  })

  describe('shutdown', () => {
    it('should shutdown rule service', async () => {
      await service.shutdown()
      
      expect(mockRuleService.shutdown).toHaveBeenCalled()
    })
  })
})