import { logger } from '@/app/services/logger'
import { RuleService } from '@/app/services/database/RuleService'
import { RuleSyncService } from '@/lib/temporal/services/rule-sync-service'
import type { NotificationRule } from '@/types/rule-engine'

export interface RulePollingLoopConfig {
  pollIntervalMs: number
  batchSize: number
  enterpriseId?: string // Optional enterprise ID filter for test isolation
  initialDelayMs?: number // Optional initial delay before first poll (default 5000ms)
}

export class RulePollingLoop {
  private isRunning = false
  private pollInterval: NodeJS.Timeout | null = null
  private lastPollTime: Date | null = null
  private ruleService: RuleService
  private ruleSyncService: RuleSyncService

  constructor(private config: RulePollingLoopConfig) {
    this.ruleService = new RuleService()
    this.ruleSyncService = new RuleSyncService()
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Rule polling loop is already running')
      return
    }

    logger.info('Starting rule polling loop', {
      config: this.config
    })

    this.isRunning = true

    // Perform initial sync of all rules
    try {
      logger.info('Performing initial rule sync', {
        enterpriseId: this.config.enterpriseId || 'all'
      })
      await this.ruleSyncService.syncAllRules(this.config.enterpriseId)
      
      // Set last poll time to current time after initial sync
      this.lastPollTime = new Date()
    } catch (error) {
      logger.error('Failed to perform initial rule sync', {
        error: error instanceof Error ? error.message : 'Unknown error',
        enterpriseId: this.config.enterpriseId
      })
      // Continue anyway, polling will pick up rules
    }

    // Start polling for changes
    this.startPolling()
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    logger.info('Stopping rule polling loop')

    this.isRunning = false

    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }

    await this.ruleSyncService.shutdown()
    await this.ruleService.shutdown()
  }

  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) return

      try {
        // If we don't have a last poll time, get it from the database
        if (!this.lastPollTime) {
          const lastUpdateTime = await this.ruleService.getLastRuleUpdateTime(this.config.enterpriseId)
          this.lastPollTime = lastUpdateTime || new Date(Date.now() - 24 * 60 * 60 * 1000) // Default to 24 hours ago
        }

        // Fetch rules updated since last poll
        const updatedRules = await this.ruleService.getRulesUpdatedAfter(
          this.lastPollTime,
          this.config.batchSize,
          this.config.enterpriseId
        )

        if (updatedRules.length > 0) {
          logger.info('Found updated rules to sync', {
            count: updatedRules.length,
            lastPollTime: this.lastPollTime.toISOString()
          })

          // Sync each updated rule
          await this.syncUpdatedRules(updatedRules)

          // Update last poll time to the latest rule's update time
          const latestUpdateTime = updatedRules.reduce((latest, rule) => {
            const ruleTime = new Date(rule.updated_at)
            return ruleTime > latest ? ruleTime : latest
          }, this.lastPollTime)

          this.lastPollTime = latestUpdateTime
        }
      } catch (error) {
        logger.error('Error in rule polling', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Initial poll after a configurable delay (default 5s, but tests can use 0)
    const initialDelay = this.config.initialDelayMs ?? 5000
    if (initialDelay > 0) {
      setTimeout(poll, initialDelay)
    } else {
      // For tests, poll immediately
      poll()
    }

    // Schedule regular polls
    this.pollInterval = setInterval(poll, this.config.pollIntervalMs)
  }

  private async syncUpdatedRules(rules: NotificationRule[]): Promise<void> {
    const promises = rules.map(async (rule) => {
      try {
        await this.ruleSyncService.syncRule(rule)
        logger.info('Synced rule with Temporal', {
          ruleId: rule.id,
          ruleName: rule.name
        })
      } catch (error) {
        logger.error('Failed to sync rule', {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    await Promise.all(promises)
  }

  /**
   * Force a reconciliation of all rules
   */
  async forceReconciliation(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Cannot reconcile rules - polling loop is not running')
      return
    }

    logger.info('Forcing rule reconciliation')
    
    try {
      const stats = await this.ruleSyncService.reconcileSchedules(this.config.enterpriseId)
      logger.info('Rule reconciliation complete', stats)
    } catch (error) {
      logger.error('Failed to reconcile rules', {
        error: error instanceof Error ? error.message : 'Unknown error',
        enterpriseId: this.config.enterpriseId
      })
    }
  }

  /**
   * Check if the polling loop is currently running
   */
  public getIsRunning(): boolean {
    return this.isRunning
  }
}