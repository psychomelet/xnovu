#!/usr/bin/env node

import { Command } from 'commander'
import { syncCronRulesToTemporal, getCronRuleScheduleStatus } from '@/lib/temporal/sync-cron-rules'
import chalk from 'chalk'

const program = new Command()

program
  .name('sync-cron-rules')
  .description('Sync notification CRON rules with Temporal schedules')
  .option('-n, --namespace <namespace>', 'Temporal namespace', process.env.TEMPORAL_NAMESPACE || 'default')
  .option('-e, --enterprise <enterpriseId>', 'Filter by enterprise ID')
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .option('-s, --status <ruleId>', 'Check status of a specific rule')
  .action(async (options) => {
    try {
      // Check status of a specific rule
      if (options.status) {
        if (!options.enterprise) {
          console.error(chalk.red('Error: Enterprise ID is required when checking rule status'))
          process.exit(1)
        }

        const status = await getCronRuleScheduleStatus(
          parseInt(options.status),
          options.enterprise,
          options.namespace
        )

        if (status.exists) {
          console.log(chalk.green(`✓ Rule ${options.status} is scheduled in Temporal`))
          console.log(`  Paused: ${status.paused ? 'Yes' : 'No'}`)
          if (status.nextRun) {
            console.log(`  Next run: ${status.nextRun.toLocaleString()}`)
          }
          if (status.lastRun) {
            console.log(`  Last run: ${status.lastRun.toLocaleString()}`)
          }
        } else {
          console.log(chalk.yellow(`⚠ Rule ${options.status} is not scheduled in Temporal`))
        }
        return
      }

      // Sync all rules
      console.log(chalk.blue(`Syncing CRON rules to Temporal namespace: ${options.namespace}`))
      if (options.dryRun) {
        console.log(chalk.yellow('DRY RUN MODE - No changes will be made'))
      }

      const result = await syncCronRulesToTemporal({
        namespace: options.namespace,
        enterpriseId: options.enterprise,
        dryRun: options.dryRun,
      })

      // Display results
      console.log('\nSync Results:')
      console.log(chalk.green(`✓ Created: ${result.created.length} schedules`))
      if (result.created.length > 0) {
        result.created.forEach(id => console.log(`    - ${id}`))
      }

      console.log(chalk.blue(`↻ Updated: ${result.updated.length} schedules`))
      if (result.updated.length > 0) {
        result.updated.forEach(id => console.log(`    - ${id}`))
      }

      console.log(chalk.red(`✗ Deleted: ${result.deleted.length} schedules`))
      if (result.deleted.length > 0) {
        result.deleted.forEach(id => console.log(`    - ${id}`))
      }

      if (result.errors.length > 0) {
        console.log(chalk.red(`\n⚠ Errors: ${result.errors.length}`))
        result.errors.forEach(({ ruleId, error }) => {
          console.log(chalk.red(`    - Rule ${ruleId}: ${error}`))
        })
      }

      console.log(chalk.green('\n✓ Sync completed successfully'))
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`))
      process.exit(1)
    }
  })

program.parse()