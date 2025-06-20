#!/usr/bin/env node

/**
 * Setup script for running tests with local Temporal server
 */

import { temporalServer } from '../../../scripts/temporal-dev-server'

async function setup() {
  console.log('Setting up test environment...')
  
  try {
    // Start Temporal server
    await temporalServer.start()
    
    // Set environment variables for tests
    process.env.TEMPORAL_ADDRESS = 'localhost:7233'
    process.env.TEMPORAL_NAMESPACE = 'default'
    
    console.log('✓ Test environment ready')
  } catch (error) {
    console.error('Failed to setup test environment:', error)
    process.exit(1)
  }
}

// Run setup if called directly
if (require.main === module) {
  setup().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}

export { setup }