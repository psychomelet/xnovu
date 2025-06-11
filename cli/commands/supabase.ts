import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export function createSupabaseCommands(program: Command): void {
  program
    .command('generate-types')
    .description('Generate TypeScript types from Supabase project')
    .action(async () => {
      console.log('🔧 Generating Supabase types from remote project...');
      
      try {
        const outputPath = path.join(process.cwd(), 'lib', 'supabase', 'database.types.ts');
        const projectId = process.env.SUPABASE_PROJECT_ID;
        
        if (!projectId) {
          console.error('❌ SUPABASE_PROJECT_ID not found in environment variables');
          console.log('💡 Make sure your .env file contains SUPABASE_PROJECT_ID');
          process.exit(1);
        }

        // Ensure the output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log(`📍 Project ID: ${projectId}`);
        console.log(`📍 Output path: ${outputPath}`);

        // Generate types from remote Supabase project
        const command = 'npx';
        const args = [
          'supabase',
          'gen',
          'types',
          'typescript',
          `--project-id=${projectId}`,
          '--schema=notify,base,shared_types'
        ];

        console.log(`🚀 Running: ${command} ${args.join(' ')}`);

        const child = spawn(command, args, {
          stdio: 'pipe',
          shell: true
        });

        let output = '';
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          console.error(data.toString());
        });

        child.on('close', (code) => {
          if (code === 0) {
            // Write the output to the file
            fs.writeFileSync(outputPath, output, 'utf8');
            console.log('✅ Successfully generated Supabase types!');
            console.log(`📁 Types saved to: ${outputPath}`);
          } else {
            console.error(`❌ Command failed with exit code ${code}`);
            console.log('💡 Make sure you have:');
            console.log('   1. Supabase CLI installed: npm install -g supabase');
            console.log('   2. Valid SUPABASE_PROJECT_ID in .env');
            console.log('   3. Authenticated with Supabase: supabase login');
            process.exit(code || 1);
          }
        });

        child.on('error', (error) => {
          console.error('❌ Failed to start command:', error.message);
          process.exit(1);
        });

      } catch (error) {
        console.error('❌ Error generating types:', error);
        process.exit(1);
      }
    });
}