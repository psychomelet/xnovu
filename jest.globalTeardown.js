/**
 * Jest Global Teardown
 * Runs once after all test suites
 */

const { execSync } = require('child_process');

module.exports = async function globalTeardown() {
  console.log('\n🧹 Jest Global Teardown\n');

  // Only clean up Temporal if we started it
  if (process.env.RUN_TEMPORAL_TESTS === 'true' || process.env.TEST_INTEGRATION === 'true') {
    try {
      // Check if temporal-test container exists
      const containerExists = execSync('docker ps -a -q -f name=temporal-test', { encoding: 'utf8' }).trim();
      
      if (containerExists) {
        console.log('🛑 Stopping Temporal test container...');
        execSync('docker stop temporal-test', { stdio: 'ignore' });
        execSync('docker rm temporal-test', { stdio: 'ignore' });
        console.log('✅ Temporal test container removed');
      }
    } catch (error) {
      console.warn('⚠️  Failed to clean up Temporal container:', error.message);
      console.log('ℹ️  You can clean up manually with: docker rm -f temporal-test');
    }
  }

  console.log('\n✅ Global teardown complete\n');
};