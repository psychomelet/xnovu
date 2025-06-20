#!/usr/bin/env node

/**
 * Setup script for running tests with local Temporal server
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

async function setup() {
  console.log('Setting up test environment...')
  
  try {
    // Write a PID file so we can clean up later
    const pidFile = path.join(__dirname, '.temporal.pid')
    
    // Start Temporal server in background using spawn directly
    const temporalProcess = spawn('temporal', [
      'server',
      'start-dev',
      '--headless',
    ], {
      stdio: 'ignore',
      detached: true,
    })
    
    // Unref to allow this process to exit
    temporalProcess.unref()
    
    // Save PID for cleanup
    fs.writeFileSync(pidFile, temporalProcess.pid.toString())
    
    // Set environment variables for tests
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.TEMPORAL_NAMESPACE = 'default'
    
    // Wait a bit for server to start
    console.log('Waiting for Temporal server to start...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('✓ Test environment ready')
    
    // Exit successfully - Temporal will continue running in background
    process.exit(0)
  } catch (error) {
    console.error('Failed to setup test environment:', error)
    process.exit(1)
  }
}

// Run setup if called directly
if (require.main === module) {
  setup()
}

export { setup }