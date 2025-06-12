import { Runtime, DefaultLogger, makeTelemetryFilterString } from '@temporalio/worker'
import * as path from 'path'

// Configure worker runtime
Runtime.install({
  logger: new DefaultLogger('INFO', (info) => {
    const { level, message, timestampNanos } = info
    console.log(`[${level}] ${new Date(Number(timestampNanos / 1000000n)).toISOString()} ${message}`)
  }),
  telemetryOptions: {
    tracingFilter: makeTelemetryFilterString({ core: 'INFO', other: 'INFO' }),
  },
})

export const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'xnovu-notification-processing'

export const workerConfig = {
  namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  taskQueue: TASK_QUEUE,
  workflowsPath: path.join(__dirname, '../workflows'),
  maxConcurrentActivityExecutions: parseInt(process.env.TEMPORAL_MAX_CONCURRENT_ACTIVITIES || '100'),
  maxConcurrentWorkflowExecutions: parseInt(process.env.TEMPORAL_MAX_CONCURRENT_WORKFLOWS || '50'),
  maxCachedWorkflows: parseInt(process.env.TEMPORAL_MAX_CACHED_WORKFLOWS || '100'),
  reuseV8Context: true,
}

export const activityDefaults = {
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '5m',
    maximumAttempts: 10,
  },
}