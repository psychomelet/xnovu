import { initializeTestEnterpriseId } from './test-data';

export default async function globalSetup() {
  console.log('\n🚀 Global test setup starting...');
  
  // Initialize test enterprise ID for this test run
  const enterpriseId = initializeTestEnterpriseId();
  
  // Store in environment for teardown access
  process.env.TEST_ENTERPRISE_ID = enterpriseId;
  
  console.log('✅ Global test setup complete\n');
}