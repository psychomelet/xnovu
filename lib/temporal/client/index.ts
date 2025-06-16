import { Connection, WorkflowClient } from '@temporalio/client'

let connection: Connection | null = null
let client: WorkflowClient | null = null

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
    client = new WorkflowClient({
      connection: conn,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
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
}