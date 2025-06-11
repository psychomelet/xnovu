import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export function createStatusCommands(program: Command): void {
  program
    .command('status')
    .description('Check XNovu system status and connections')
    .action(async () => {
      console.log('🔍 Checking XNovu system status...');
      
      try {
        // Check Supabase connection
        console.log('🗄️  Checking Supabase connection...');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const databaseUrl = process.env.DATABASE_URL;
        
        if (supabaseUrl && supabaseAnonKey) {
          console.log('✅ Supabase environment variables are set');
          console.log(`📍 URL: ${supabaseUrl}`);
          console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
          
          // Test Supabase connection
          try {
            const testResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
              headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
              }
            });
            
            if (testResponse.ok) {
              console.log('✅ Supabase API connection successful');
            } else {
              console.log('⚠️  Supabase API connection failed');
            }
          } catch (connError) {
            console.log('❌ Failed to connect to Supabase API');
          }
        } else {
          console.log('⚠️  Supabase environment variables not found');
        }

        // Check PostgreSQL connection
        if (databaseUrl) {
          console.log('\n🐘 Checking PostgreSQL connection...');
          console.log(`📍 Database URL: ${databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
          
          try {
            // Test PostgreSQL connection using psql
            execSync(`psql "${databaseUrl}" -c "SELECT version();"`, { 
              stdio: 'pipe',
              timeout: 5000 
            });
            console.log('✅ PostgreSQL connection successful');
          } catch (pgError) {
            console.log('❌ PostgreSQL connection failed');
            console.log('💡 Make sure PostgreSQL client (psql) is installed');
          }
        } else {
          console.log('\n🐘 PostgreSQL connection...');
          console.log('⚠️  DATABASE_URL not found');
        }

        // Check Novu configuration
        console.log('\n🔔 Checking Novu configuration...');
        const novuSecretKey = process.env.NOVU_SECRET_KEY;
        const novuAppId = process.env.NEXT_PUBLIC_NOVU_APPLICATION_IDENTIFIER;
        
        if (novuSecretKey && novuSecretKey !== 'your_cloud_secret_key') {
          console.log('✅ Novu secret key is configured');
        } else {
          console.log('⚠️  Novu secret key not configured (using default)');
        }
        
        if (novuAppId && novuAppId !== 'your_app_identifier') {
          console.log('✅ Novu application identifier is configured');
        } else {
          console.log('⚠️  Novu application identifier not configured (using default)');
        }

        // Check for required files
        console.log('\n📁 Checking required files...');
        const requiredFiles = [
          'lib/supabase/client.ts',
          'lib/supabase/database.types.ts',
          'app/novu/workflows/index.ts'
        ];

        requiredFiles.forEach(file => {
          const fullPath = path.join(process.cwd(), file);
          if (fs.existsSync(fullPath)) {
            console.log(`✅ ${file}`);
          } else {
            console.log(`❌ ${file} (missing)`);
          }
        });

        console.log('\n💡 To generate missing types, run: pnpm xnovu generate-types');

      } catch (error) {
        console.error('❌ Error checking status:', error);
        process.exit(1);
      }
    });
}