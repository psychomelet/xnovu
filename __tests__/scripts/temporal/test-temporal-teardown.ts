#!/usr/bin/env node

/**
 * Teardown script for cleaning up after tests
 */

import * as fs from 'fs'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function teardown() {
  console.log('Cleaning up test environment...')
  
  try {
    const pidFile = path.join(__dirname, '.temporal.pid')
    
    // Check if PID file exists
    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf-8').trim()
      
      try {
        // Kill the process
        process.kill(parseInt(pid), 'SIGTERM')
        console.log(`✓ Stopped Temporal server (PID: ${pid})`)
      } catch (error) {
        // Process might already be dead
        console.log('Temporal server was not running')
      }
      
      // Remove PID file
      fs.unlinkSync(pidFile)
    }
    
    // Also try to stop using pnpm command as fallback
    try {
      await execAsync('pnpm temporal:stop')
    } catch {
      // Ignore errors - server might not be running
    }
    
    console.log('✓ Test environment cleaned up')
  } catch (error) {
    console.error('Failed to cleanup test environment:', error)
    process.exit(1)
  }
}

// Run teardown if called directly
if (require.main === module) {
  teardown().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export { teardown }