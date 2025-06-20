#!/usr/bin/env node

/**
 * Teardown script for cleaning up after tests
 */

import { temporalServer } from './temporal-dev-server'

async function teardown() {
  console.log('Cleaning up test environment...')
  
  try {
    // Stop Temporal server
    await temporalServer.stop()
    
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