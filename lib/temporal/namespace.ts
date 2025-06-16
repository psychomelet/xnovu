import { Connection } from '@temporalio/client'
import { logger } from '@/app/services/logger'

export async function ensureNamespaceExists(connection: Connection, namespace: string): Promise<void> {
  if (!namespace || namespace === 'default') {
    // Default namespace always exists
    return
  }

  try {
    // Try to describe the namespace first
    await connection.workflowService.describeNamespace({ namespace })
    logger.temporal(`Namespace '${namespace}' already exists`)
  } catch (error: any) {
    if (error?.code === 5) { // NOT_FOUND
      logger.temporal(`Namespace '${namespace}' not found, attempting to create...`)
      
      try {
        // Create the namespace
        await connection.workflowService.registerNamespace({
          namespace,
          workflowExecutionRetentionPeriod: {
            seconds: 7 * 24 * 60 * 60 // 7 days retention
          },
          description: 'XNovu notification processing namespace',
          isGlobalNamespace: false
        })
        
        logger.temporal(`Successfully created namespace '${namespace}'`)
      } catch (createError: any) {
        // Check if namespace was created by another process
        if (createError?.code === 6) { // ALREADY_EXISTS
          logger.temporal(`Namespace '${namespace}' was created by another process`)
        } else {
          logger.error(`Failed to create namespace '${namespace}'`, createError)
          throw createError
        }
      }
    } else {
      // Some other error occurred
      logger.error(`Error checking namespace '${namespace}'`, error)
      throw error
    }
  }
}