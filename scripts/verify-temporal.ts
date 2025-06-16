import { Connection } from '@temporalio/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function verify() {
  const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log(`Checking Temporal at ${address}...`);
  
  try {
    const connection = await Connection.connect({
      address,
      tls: address.includes(':443') ? {} : false,
      connectTimeout: '5s',
    });
    
    const info = await connection.workflowService.getSystemInfo({});
    console.log('✅ Temporal is available');
    console.log(`   Version: ${info.serverVersion}`);
    await connection.close();
  } catch (error: any) {
    console.log('❌ Temporal is NOT available');
    console.log(`   Error: ${error.message}`);
  }
}

verify();