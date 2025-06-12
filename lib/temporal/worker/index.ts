import { Worker, NativeConnection } from '@temporalio/worker'
import { workerConfig } from './config'
import * as activities from '../activities'

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
  console.log('Starting Temporal worker...')
  await w.run()
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    console.log('Stopping Temporal worker...')
    worker.shutdown()
    await worker.runUntil(Date.now() + 10000) // Give 10 seconds for graceful shutdown
    worker = null
  }
  if (workerConnection) {
    await workerConnection.close()
    workerConnection = null
  }
}