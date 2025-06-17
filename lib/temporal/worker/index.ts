import { Worker, NativeConnection } from '@temporalio/worker'
import { Connection } from '@temporalio/client'
import { workerConfig } from './config'
import * as activities from '../activities'
import { logger } from '@/app/services/logger'
import { ensureNamespaceExists } from '../namespace'
import { NotificationPollingLoop } from '@/lib/polling/polling-loop'

let worker: Worker | null = null
let workerConnection: NativeConnection | null = null
let pollingLoop: NotificationPollingLoop | null = null

export async function createWorker(): Promise<Worker> {
  if (!workerConnection) {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    const isSecure = address.includes(':443') || address.startsWith('https://')
    
    // First ensure namespace exists using a client connection
    const clientConnection = await Connection.connect({
      address,
      tls: isSecure ? {} : false,
    })
    
    try {
      await ensureNamespaceExists(clientConnection, workerConfig.namespace)
    } finally {
      await clientConnection.close()
    }
    
    // Now create the worker connection
    workerConnection = await NativeConnection.connect({
      address,
      tls: isSecure ? {} : false,
    })
  }

  worker = await Worker.create({
    connection: workerConnection,
    namespace: workerConfig.namespace,
    taskQueue: workerConfig.taskQueue,
    workflowsPath: workerConfig.workflowsPath,
    activities,
    maxConcurrentActivityTaskExecutions: workerConfig.maxConcurrentActivityExecutions,
    maxConcurrentWorkflowTaskExecutions: workerConfig.maxConcurrentWorkflowExecutions,
    maxCachedWorkflows: workerConfig.maxCachedWorkflows,
    reuseV8Context: workerConfig.reuseV8Context,
  })

  return worker
}

export async function startWorker(): Promise<void> {
  // Start the polling loop
  pollingLoop = new NotificationPollingLoop({
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '10000', 10),
    failedPollIntervalMs: parseInt(process.env.FAILED_POLL_INTERVAL_MS || '60000', 10),
    scheduledPollIntervalMs: parseInt(process.env.SCHEDULED_POLL_INTERVAL_MS || '30000', 10),
    batchSize: parseInt(process.env.POLL_BATCH_SIZE || '100', 10),
    temporal: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      namespace: workerConfig.namespace,
      taskQueue: workerConfig.taskQueue,
    },
  })
  
  logger.temporal('Starting notification polling loop...')
  await pollingLoop.start()
  
  // Start the temporal worker
  const w = await createWorker()
  logger.temporal('Starting Temporal worker...')
  await w.run()
}

export async function stopWorker(): Promise<void> {
  // Stop the polling loop
  if (pollingLoop) {
    logger.temporal('Stopping notification polling loop...')
    await pollingLoop.stop()
    pollingLoop = null
  }
  
  // Stop the temporal worker
  if (worker) {
    logger.temporal('Stopping Temporal worker...')
    worker.shutdown()
    // Wait for shutdown to complete
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!worker || worker.getState() === 'STOPPED') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      // Force resolve after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve()
      }, 10000)
    })
    worker = null
  }
  if (workerConnection) {
    await workerConnection.close()
    workerConnection = null
  }
}