import { Worker, NativeConnection } from '@temporalio/worker'
import { workerConfig } from './config'
import * as activities from '../activities'
import { logger } from '@/app/services/logger'

let worker: Worker | null = null
let workerConnection: NativeConnection | null = null

export async function createWorker(): Promise<Worker> {
  if (!workerConnection) {
    workerConnection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
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
  const w = await createWorker()
  logger.temporal('Starting Temporal worker...')
  await w.run()
}

export async function stopWorker(): Promise<void> {
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