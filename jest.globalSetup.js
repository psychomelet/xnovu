/**
 * Jest Global Setup
 * Runs once before all test suites
 */

const { execSync } = require('child_process');

module.exports = async function globalSetup() {
  console.log('\n🚀 Jest Global Setup\n');

  // Only start Temporal for integration tests if explicitly requested
  if (process.env.RUN_TEMPORAL_TESTS === 'true' || process.env.TEST_INTEGRATION === 'true') {
    console.log('📦 Starting Temporal dev server for tests...');
    
    try {
      // Check if Temporal is already running
      try {
        execSync('curl -f http://localhost:7233/metrics', { stdio: 'ignore' });
        console.log('✅ Temporal is already running');
      } catch {
        // Temporal not running, start it
        console.log('🔄 Starting Temporal container...');
        execSync('docker run -d --name temporal-test -p 7233:7233 temporalio/auto-setup:latest');
        
        // Wait for Temporal to be ready
        console.log('⏳ Waiting for Temporal to be ready...');
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
          try {
            execSync('curl -f http://localhost:7233/metrics', { stdio: 'ignore' });
            console.log('✅ Temporal is ready');
            break;
          } catch {
            attempts++;
            if (attempts >= maxAttempts) {
              throw new Error('Temporal failed to start in time');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to start Temporal:', error.message);
      console.log('ℹ️  You can start Temporal manually with: pnpm temporal:start');
      throw error;
    }
  } else {
    console.log('ℹ️  Skipping Temporal setup (not needed for unit tests)');
    console.log('ℹ️  To run integration tests: TEST_INTEGRATION=true pnpm test');
  }

  console.log('\n✅ Global setup complete\n');
};