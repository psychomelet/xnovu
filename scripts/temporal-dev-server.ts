#!/usr/bin/env node

/**
 * Script to manage local Temporal dev server for testing
 */

import { spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { createConnection } from 'net'

const sleep = promisify(setTimeout)

interface TemporalServerManager {
  start(): Promise<void>
  stop(): Promise<void>
  waitForReady(maxAttempts?: number): Promise<boolean>
}

class LocalTemporalServer implements TemporalServerManager {
  private process: ChildProcess | null = null
  private readonly port = 7233
  private readonly uiPort = 8080

  async start(): Promise<void> {
    if (this.process) {
      console.log('Temporal server is already running')
      return
    }

    console.log('Starting local Temporal dev server...')
    
    this.process = spawn('temporal', [
      'server',
      'start-dev',
      '--headless',
      '--namespace', 'default',
      '--ip', '127.0.0.1',
      '--log-level', 'warn',
    ], {
      stdio: 'pipe',
      detached: false,
    })

    this.process.stdout?.on('data', (data) => {
      if (process.env.DEBUG_TEMPORAL) {
        console.log(`[Temporal]: ${data}`)
      }
    })

    this.process.stderr?.on('data', (data) => {
      if (process.env.DEBUG_TEMPORAL) {
        console.error(`[Temporal Error]: ${data}`)
      }
    })

    this.process.on('error', (error) => {
      console.error('Failed to start Temporal server:', error)
      throw error
    })

    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Temporal server exited with code ${code}`)
      }
      this.process = null
    })

    // Wait for server to be ready
    const isReady = await this.waitForReady()
    if (!isReady) {
      await this.stop()
      throw new Error('Temporal server failed to start within timeout')
    }

    console.log(`✓ Temporal server is ready on port ${this.port}`)
  }

  async stop(): Promise<void> {
    if (!this.process) {
      return
    }

    console.log('Stopping Temporal server...')
    
    return new Promise((resolve) => {
      this.process!.on('exit', () => {
        this.process = null
        console.log('✓ Temporal server stopped')
        resolve()
      })

      this.process!.kill('SIGTERM')
      
      // Force kill after 5 seconds if graceful shutdown fails
      setTimeout(() => {
        if (this.process) {
          console.log('Force killing Temporal server...')
          this.process.kill('SIGKILL')
        }
      }, 5000)
    })
  }

  async waitForReady(maxAttempts = 30): Promise<boolean> {
    console.log('Waiting for Temporal server to be ready...')
    
    for (let i = 1; i <= maxAttempts; i++) {
      if (await this.checkPort(this.port)) {
        // Additional check: try to connect with the Temporal client
        try {
          const { Connection } = await import('@temporalio/client')
          const connection = await Connection.connect({
            address: `localhost:${this.port}`,
            connectTimeout: '2s',
          })
          await connection.workflowService.getSystemInfo({})
          await connection.close()
          return true
        } catch (error) {
          // Connection not ready yet
          if (process.env.DEBUG_TEMPORAL) {
            console.log(`Connection attempt ${i}/${maxAttempts} failed:`, error)
          }
        }
      }
      
      if (i < maxAttempts) {
        process.stdout.write(`\rWaiting for Temporal server... (${i}/${maxAttempts})`)
        await sleep(1000)
      }
    }
    
    console.log('\n✗ Temporal server failed to start within timeout')
    return false
  }

  private checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = createConnection(port, 'localhost')
      
      socket.on('connect', () => {
        socket.end()
        resolve(true)
      })
      
      socket.on('error', () => {
        resolve(false)
      })
      
      socket.setTimeout(1000)
      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })
    })
  }
}

// Export for programmatic use
export const temporalServer = new LocalTemporalServer()

// Handle CLI usage
if (require.main === module) {
  const command = process.argv[2]
  
  const handleExit = async () => {
    console.log('\nShutting down Temporal server...')
    await temporalServer.stop()
    process.exit(0)
  }
  
  process.on('SIGINT', handleExit)
  process.on('SIGTERM', handleExit)
  
  ;(async () => {
    try {
      switch (command) {
        case 'start':
          await temporalServer.start()
          // Keep the process running
          await new Promise(() => {})
          break
          
        case 'stop':
          await temporalServer.stop()
          break
          
        case 'check':
          const isReady = await temporalServer.waitForReady(1)
          process.exit(isReady ? 0 : 1)
          break
          
        default:
          console.log('Usage: temporal-dev-server [start|stop|check]')
          console.log('  start - Start the Temporal dev server')
          console.log('  stop  - Stop the Temporal dev server')
          console.log('  check - Check if Temporal server is running')
          process.exit(1)
      }
    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    }
  })()
}