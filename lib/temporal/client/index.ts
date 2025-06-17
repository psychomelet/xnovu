import { Connection, WorkflowClient } from '@temporalio/client'
import { ensureNamespaceExists } from '../namespace'

let connection: Connection | null = null
let client: WorkflowClient | null = null
let namespaceInitialized = false

export async function getTemporalConnection(): Promise<Connection> {
  if (!connection) {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    const isSecure = address.includes(':443') || address.startsWith('https://')
    
    connection = await Connection.connect({
      address,
      tls: isSecure ? {} : false,
    })
  }
  return connection
}

export async function getTemporalClient(): Promise<WorkflowClient> {
  if (!client) {
    const conn = await getTemporalConnection()
    const namespace = process.env.TEMPORAL_NAMESPACE || 'default'
    
    // Ensure namespace exists on first client creation
    if (!namespaceInitialized) {
      await ensureNamespaceExists(conn, namespace)
      namespaceInitialized = true
    }
    
    client = new WorkflowClient({
      connection: conn,
      namespace,
    })
  }
  return client
}

export async function closeTemporalConnection(): Promise<void> {
  if (client) {
    client = null
  }
  if (connection) {
    await connection.close()
    connection = null
  }
  namespaceInitialized = false
}

// Export notification client
export { NotificationClient, notificationClient } from './notification-client'

// Export schedule client
export * from './schedule-client'