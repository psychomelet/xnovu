import { RuleService } from '@/app/services/database/RuleService'
import { logger } from '@/app/services/logger'
import { NotificationRule } from '@/types/rule-engine'
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  listSchedules,
  getScheduleId,
} from '../client/schedule-client'

export class RuleSyncService {
  private ruleService: RuleService

  constructor() {
    this.ruleService = new RuleService()
  }

  /**
   * Sync all active rules with Temporal schedules on startup
   */
  async syncAllRules(): Promise<void> {
    logger.info('Starting full rule sync with Temporal schedules')
    
    try {
      // Get all active CRON rules from database
      const activeRules = await this.ruleService.getActiveCronRules()
      logger.info(`Found ${activeRules.length} active CRON rules to sync`)
      
      // Get all existing schedules from Temporal
      const existingSchedules = await listSchedules()
      const scheduleMap = new Map<string, boolean>()
      
      for (const schedule of existingSchedules) {
        scheduleMap.set(schedule.id, true)
      }
      
      // Track schedules that should exist
      const expectedScheduleIds = new Set<string>()
      
      // Create or update schedules for active rules
      for (const rule of activeRules) {
        const scheduleId = getScheduleId(rule)
        expectedScheduleIds.add(scheduleId)
        
        try {
          if (scheduleMap.has(scheduleId)) {
            // Update existing schedule
            await updateSchedule(rule)
            logger.info('Updated schedule for rule', {
              ruleId: rule.id,
              scheduleId
            })
          } else {
            // Create new schedule
            await createSchedule(rule)
            logger.info('Created schedule for rule', {
              ruleId: rule.id,
              scheduleId
            })
          }
        } catch (error) {
          logger.error('Failed to sync rule', {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Delete schedules that no longer have active rules
      for (const schedule of existingSchedules) {
        if (!expectedScheduleIds.has(schedule.id) && schedule.id.startsWith('rule-')) {
          try {
            logger.info('Deleting orphaned schedule', { scheduleId: schedule.id })
            // Create a minimal rule object for deletion
            const parts = schedule.id.split('-')
            if (parts.length >= 3) {
              const ruleId = parseInt(parts[1], 10)
              const enterpriseId = parts.slice(2).join('-')
              await deleteSchedule({
                id: ruleId,
                enterprise_id: enterpriseId,
              } as NotificationRule)
            }
          } catch (error) {
            logger.error('Failed to delete orphaned schedule', {
              scheduleId: schedule.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
      }
      
      logger.info('Completed full rule sync with Temporal schedules')
    } catch (error) {
      logger.error('Failed to sync all rules', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Sync a single rule with Temporal
   */
  async syncRule(rule: NotificationRule): Promise<void> {
    try {
      // Only sync CRON rules
      if (rule.trigger_type !== 'CRON') {
        logger.warn('Skipping non-CRON rule', {
          ruleId: rule.id,
          triggerType: rule.trigger_type
        })
        return
      }
      
      // Check if rule should have a schedule
      const shouldHaveSchedule = 
        rule.publish_status === 'PUBLISH' && 
        !rule.deactivated &&
        rule.trigger_config &&
        typeof rule.trigger_config === 'object' &&
        'cron' in rule.trigger_config
      
      if (shouldHaveSchedule) {
        // Create or update schedule
        await updateSchedule(rule)
        logger.info('Synced rule with Temporal', {
          ruleId: rule.id,
          action: 'create_or_update'
        })
      } else {
        // Remove schedule if it exists
        await this.removeSchedule(rule)
        logger.info('Removed schedule for inactive rule', {
          ruleId: rule.id
        })
      }
    } catch (error) {
      logger.error('Failed to sync rule', {
        ruleId: rule.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Remove schedule for a rule
   */
  async removeSchedule(rule: NotificationRule): Promise<void> {
    try {
      await deleteSchedule(rule)
      logger.info('Deleted schedule for rule', {
        ruleId: rule.id
      })
    } catch (error) {
      logger.error('Failed to delete schedule', {
        ruleId: rule.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Reconcile schedules between database and Temporal
   */
  async reconcileSchedules(): Promise<{
    created: number
    updated: number
    deleted: number
    errors: number
  }> {
    const stats = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
    }
    
    try {
      // Get all active rules
      const activeRules = await this.ruleService.getActiveCronRules()
      const ruleMap = new Map<string, NotificationRule>()
      
      for (const rule of activeRules) {
        const scheduleId = getScheduleId(rule)
        ruleMap.set(scheduleId, rule)
      }
      
      // Get all schedules
      const schedules = await listSchedules()
      
      // Update or create schedules for active rules
      for (const [scheduleId, rule] of ruleMap) {
        try {
          const existingSchedule = schedules.find(s => s.id === scheduleId)
          
          if (existingSchedule) {
            await updateSchedule(rule)
            stats.updated++
          } else {
            await createSchedule(rule)
            stats.created++
          }
        } catch (error) {
          stats.errors++
          logger.error('Failed to reconcile rule', {
            ruleId: rule.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
      
      // Delete orphaned schedules
      for (const schedule of schedules) {
        if (!ruleMap.has(schedule.id) && schedule.id.startsWith('rule-')) {
          try {
            // Extract rule info from schedule ID
            const parts = schedule.id.split('-')
            if (parts.length >= 3) {
              const ruleId = parseInt(parts[1], 10)
              const enterpriseId = parts.slice(2).join('-')
              await deleteSchedule({
                id: ruleId,
                enterprise_id: enterpriseId,
              } as NotificationRule)
              stats.deleted++
            }
          } catch (error) {
            stats.errors++
            logger.error('Failed to delete orphaned schedule', {
              scheduleId: schedule.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }
      }
      
      logger.info('Reconciliation complete', stats)
      return stats
    } catch (error) {
      logger.error('Failed to reconcile schedules', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  /**
   * Cleanup and close connections
   */
  async shutdown(): Promise<void> {
    await this.ruleService.shutdown()
  }
}