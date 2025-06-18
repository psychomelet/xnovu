import { initializeTestEnterpriseId } from './test-data';
import { Connection } from '@temporalio/client';
import { ensureNamespaceExists } from '@/lib/temporal/namespace';

export default async function globalSetup() {
  console.log('\n🚀 Global test setup starting...');
  
  // Initialize test enterprise ID for this test run
  const enterpriseId = initializeTestEnterpriseId();
  
  // Store in environment for teardown access
  process.env.TEST_ENTERPRISE_ID = enterpriseId;
  
  // Create test namespace using enterprise ID
  const testNamespace = `test-ns-${enterpriseId}`;
  process.env.TEMPORAL_NAMESPACE = testNamespace;
  
  let connection: Connection | null = null;
  try {
    const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
    const isSecure = address.includes(':443') || address.startsWith('https://');
    
    connection = await Connection.connect({
      address,
      tls: isSecure ? {} : false,
    });
    
    await ensureNamespaceExists(connection, testNamespace);
  } catch (error) {
    console.error('❌ Failed to create test namespace:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
  
  console.log('✅ Global test setup complete\n');
}