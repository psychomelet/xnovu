import { Command } from 'commander';
import { readdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { NotificationChannelType } from '@/app/novu/types/metadata';

const WORKFLOWS_PATH = join(process.cwd(), 'app', 'novu', 'workflows');
const NOVU_PATH = join(process.cwd(), 'app', 'novu');

// Helper to extract exported metadata name from file
function extractMetadataExportName(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf8');
    const match = content.match(/export\s+const\s+(\w+Metadata)\s*=/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

// Helper to analyze workflow file and extract channels
function extractChannelsFromWorkflow(workflowPath: string): NotificationChannelType[] {
  const channels: NotificationChannelType[] = [];
  
  try {
    const content = readFileSync(workflowPath, 'utf8');
    
    // Check for different step types
    if (content.includes('step.email(')) channels.push('EMAIL');
    if (content.includes('step.inApp(')) channels.push('IN_APP');
    if (content.includes('step.sms(')) channels.push('SMS');
    if (content.includes('step.push(')) channels.push('PUSH');
    if (content.includes('step.chat(')) channels.push('CHAT');
    
    return channels;
  } catch (error) {
    console.error(`Error reading workflow file ${workflowPath}:`, error);
    return [];
  }
}

// Helper to extract workflow key from workflow.ts
function extractWorkflowKey(workflowPath: string): string | null {
  try {
    const content = readFileSync(workflowPath, 'utf8');
    const match = content.match(/workflow\s*\(\s*["']([^"']+)["']/);
    return match ? match[1] : null;
  } catch (error) {
    console.error(`Error extracting workflow key from ${workflowPath}:`, error);
    return null;
  }
}

// Generate metadata template
function generateMetadataTemplate(workflowDir: string, workflowKey: string, channels: NotificationChannelType[]): string {
  const workflowName = workflowDir
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  const hasSchemas = existsSync(join(WORKFLOWS_PATH, workflowDir, 'schemas.ts'));
  
  return `import { zodToJsonSchema } from 'zod-to-json-schema';
import { createWorkflowMetadata } from '@/app/novu/types/metadata';
${hasSchemas ? `import { /* TODO: import your schemas */ } from './schemas';` : ''}

export const ${workflowDir.replace(/-/g, '')}Metadata = createWorkflowMetadata({
  workflow_key: '${workflowKey}',
  name: '${workflowName}',
  description: 'TODO: Add a description for this workflow',
  workflow_type: 'STATIC', // TODO: Change to 'DYNAMIC' if this is a user-configurable workflow
  default_channels: [${channels.map(c => `'${c}'`).join(', ')}],
  payload_schema: ${hasSchemas ? `zodToJsonSchema(/* TODO: your payload schema */) as Record<string, any>` : 'null'},
  control_schema: ${hasSchemas ? `zodToJsonSchema(/* TODO: your control schema */) as Record<string, any>` : 'null'},
  // Optional fields:
  // template_overrides: {},
  // typ_notification_category_id: 1,
  // business_id: 'business-123',
  // enterprise_id: 'enterprise-123',
});`;
}

function generateWorkflowFiles() {
  console.log('🔄 Workflow Generation Process Starting...\n');

  // Get all workflow directories
  const directories = readdirSync(WORKFLOWS_PATH, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort();

  console.log(`📁 Found ${directories.length} workflow directories\n`);

  // Step 1: Generate missing metadata files
  console.log('📝 Step 1: Checking for missing metadata files...');
  let metadataGenerated = 0;
  
  for (const dir of directories) {
    const workflowDir = join(WORKFLOWS_PATH, dir);
    const metadataPath = join(workflowDir, 'metadata.ts');
    const workflowPath = join(workflowDir, 'workflow.ts');
    
    if (!existsSync(metadataPath)) {
      console.log(`   📁 Processing ${dir}...`);
      
      if (!existsSync(workflowPath)) {
        console.log(`      ⚠️  No workflow.ts found, skipping`);
        continue;
      }
      
      const workflowKey = extractWorkflowKey(workflowPath);
      if (!workflowKey) {
        console.log(`      ⚠️  Could not extract workflow key, skipping`);
        continue;
      }
      
      const channels = extractChannelsFromWorkflow(workflowPath);
      console.log(`      Found workflow key: ${workflowKey}`);
      console.log(`      Found channels: ${channels.join(', ') || 'none'}`);
      
      const metadata = generateMetadataTemplate(dir, workflowKey, channels);
      writeFileSync(metadataPath, metadata);
      
      console.log(`      ✅ Generated metadata.ts`);
      metadataGenerated++;
    }
  }
  
  if (metadataGenerated > 0) {
    console.log(`\n   ✨ Generated ${metadataGenerated} metadata files`);
    console.log('\n   ⚠️  Important: Please review and update the generated metadata files');
  } else {
    console.log('   ✅ All workflows have metadata files');
  }

  // Step 2: Generate index files
  console.log('\n📝 Step 2: Generating workflow index files...');

  // Generate index.ts content (in workflows directory)
  const indexContent = `/**
 * Auto-generated workflow exports
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

${directories.map(dir => `export * from "./${dir}";`).join('\n')}
`;

  const indexPath = join(WORKFLOWS_PATH, 'index.ts');
  writeFileSync(indexPath, indexContent);
  console.log(`   ✅ Generated ${indexPath}`);

  // Generate workflow-loader.ts (at novu level)
  // First, let's extract the actual workflow export names from each workflow
  const workflowExports: { dir: string; exportName: string }[] = [];
  
  for (const dir of directories) {
    const workflowPath = join(WORKFLOWS_PATH, dir, 'workflow.ts');
    if (existsSync(workflowPath)) {
      try {
        const content = readFileSync(workflowPath, 'utf8');
        // Look for export const <name> = workflow(
        const match = content.match(/export\s+(?:const\s+)?(\w+)\s*=\s*workflow\s*\(/);
        if (match) {
          workflowExports.push({ dir, exportName: match[1] });
        } else {
          // Check for default export
          if (content.includes('export default') && content.includes('workflow(')) {
            workflowExports.push({ dir, exportName: 'default' });
          }
        }
      } catch (error) {
        console.error(`Error reading ${workflowPath}:`, error);
      }
    }
  }
  
  const loaderContent = `/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
${workflowExports.map(({ dir, exportName }) => {
    if (exportName === 'default') {
      return `import ${dir.replace(/-/g, '')}Workflow from "./workflows/${dir}/workflow";`;
    } else {
      return `import { ${exportName} } from "./workflows/${dir}/workflow";`;
    }
  }).join('\n')}

// Array of all workflow instances
export const workflows = [
${workflowExports.map(({ dir, exportName }) => {
    if (exportName === 'default') {
      return `  ${dir.replace(/-/g, '')}Workflow,`;
    } else {
      return `  ${exportName},`;
    }
  }).join('\n')}
];

// Get all workflow instances
export function getAllWorkflows() {
  return workflows;
}

// Get workflow by ID
export function getWorkflowById(workflowId: string) {
  return workflows.find(workflow => workflow.id === workflowId);
}
`;

  const loaderPath = join(NOVU_PATH, 'workflow-loader.ts');
  writeFileSync(loaderPath, loaderContent);
  console.log(`   ✅ Generated ${loaderPath}`);

  // Generate workflow-metadata.ts (at novu level)
  const metadataImports: string[] = [];
  const metadataVars: string[] = [];
  
  directories.forEach(dir => {
    const metadataPath = join(WORKFLOWS_PATH, dir, 'metadata.ts');
    if (existsSync(metadataPath)) {
      const exportName = extractMetadataExportName(metadataPath);
      if (exportName) {
        metadataImports.push(`import { ${exportName} } from "./workflows/${dir}/metadata";`);
        metadataVars.push(exportName);
      }
    }
  });

  const metadataContent = `/**
 * Auto-generated workflow metadata aggregator
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

import type { WorkflowMetadata } from './types/metadata';

// Import all metadata
${metadataImports.join('\n')}

// Export all metadata as array
export const allWorkflowMetadata: WorkflowMetadata[] = [
${metadataVars.map(v => `  ${v},`).join('\n')}
];

// Export metadata as map for easy lookup
export const workflowMetadataMap: Record<string, WorkflowMetadata> = {
${metadataVars.map(v => `  [${v}.workflow_key]: ${v},`).join('\n')}
};
`;

  const metadataPath = join(NOVU_PATH, 'workflow-metadata.ts');
  writeFileSync(metadataPath, metadataContent);
  console.log(`   ✅ Generated ${metadataPath}`);

  console.log('\n✨ Workflow generation complete!');
  console.log('\n📁 Generated structure:');
  console.log('   app/novu/');
  console.log('   ├── workflow-loader.ts        (auto-generated)');
  console.log('   ├── workflow-metadata.ts      (auto-generated)');
  console.log('   └── workflows/');
  console.log('       └── index.ts              (auto-generated)');
}

export function createWorkflowCommands(program: Command) {
  const workflow = program
    .command('workflow')
    .description('Workflow management commands');

  workflow
    .command('generate')
    .description('Generate workflow metadata and index files')
    .action(() => {
      try {
        generateWorkflowFiles();
      } catch (error) {
        console.error('❌ Failed to generate workflow files:', error);
        process.exit(1);
      }
    });
}