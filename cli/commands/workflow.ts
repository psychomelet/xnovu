import { Command } from 'commander';
import { readdirSync, writeFileSync, existsSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { NotificationChannelType } from '@/app/novu/types/metadata';

const WORKFLOWS_PATH = join(process.cwd(), 'app', 'novu', 'workflows');
const NOVU_PATH = join(process.cwd(), 'app', 'novu');

// Helper to recursively find all workflow directories
function findWorkflowDirectories(baseDir: string, currentPath: string = ''): Array<{ dir: string; fullPath: string; relativePath: string }> {
  const results: Array<{ dir: string; fullPath: string; relativePath: string }> = [];
  const searchPath = currentPath ? join(baseDir, currentPath) : baseDir;
  
  try {
    const entries = readdirSync(searchPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = currentPath ? join(currentPath, entry.name) : entry.name;
        const fullPath = join(baseDir, entryPath);
        
        // Check if this directory contains a workflow.ts file
        if (existsSync(join(fullPath, 'workflow.ts'))) {
          results.push({
            dir: entry.name,
            fullPath,
            relativePath: entryPath
          });
        } else {
          // Recursively search subdirectories
          results.push(...findWorkflowDirectories(baseDir, entryPath));
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${searchPath}:`, error);
  }
  
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

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
function generateMetadataTemplate(workflowDir: string, workflowPath: string, workflowKey: string, channels: NotificationChannelType[]): string {
  const workflowName = workflowDir
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  const hasSchemas = existsSync(join(workflowPath, 'schemas.ts'));
  
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

  // Get all workflow directories recursively
  const workflowDirs = findWorkflowDirectories(WORKFLOWS_PATH);

  console.log(`📁 Found ${workflowDirs.length} workflow directories\n`);
  workflowDirs.forEach(({ relativePath }) => {
    console.log(`   - ${relativePath}`);
  });
  console.log();

  // Step 1: Generate missing metadata files
  console.log('📝 Step 1: Checking for missing metadata files...');
  let metadataGenerated = 0;
  
  for (const { dir, fullPath, relativePath } of workflowDirs) {
    const metadataPath = join(fullPath, 'metadata.ts');
    const workflowPath = join(fullPath, 'workflow.ts');
    
    if (!existsSync(metadataPath)) {
      console.log(`   📁 Processing ${relativePath}...`);
      
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
      
      const metadata = generateMetadataTemplate(dir, fullPath, workflowKey, channels);
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
  // We need to identify the top-level directories that contain workflows or subdirectories with workflows
  const topLevelDirs = new Set<string>();
  workflowDirs.forEach(({ relativePath }) => {
    const topLevel = relativePath.split('/')[0];
    topLevelDirs.add(topLevel);
  });

  const indexContent = `/**
 * Auto-generated workflow exports
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

${Array.from(topLevelDirs).sort().map(dir => `export * from "./${dir}";`).join('\n')}
`;

  const indexPath = join(WORKFLOWS_PATH, 'index.ts');
  writeFileSync(indexPath, indexContent);
  console.log(`   ✅ Generated ${indexPath}`);

  // Generate index files for subdirectories
  const subdirs = new Map<string, string[]>();
  workflowDirs.forEach(({ dir, relativePath }) => {
    const parts = relativePath.split('/');
    if (parts.length > 1) {
      const subdir = parts[0];
      if (!subdirs.has(subdir)) {
        subdirs.set(subdir, []);
      }
      subdirs.get(subdir)!.push(dir);
    }
  });

  for (const [subdir, workflows] of subdirs) {
    const subdirIndexContent = `/**
 * Auto-generated ${subdir} workflow exports
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

${workflows.sort().map(dir => `export * from "./${dir}";`).join('\n')}`;

    const subdirIndexPath = join(WORKFLOWS_PATH, subdir, 'index.ts');
    writeFileSync(subdirIndexPath, subdirIndexContent);
    console.log(`   ✅ Generated ${subdirIndexPath}`);
  }

  // Generate workflow-loader.ts (at novu level)
  // First, let's extract the actual workflow export names from each workflow
  const workflowExports: { dir: string; relativePath: string; exportName: string }[] = [];
  
  for (const { dir, fullPath, relativePath } of workflowDirs) {
    const workflowPath = join(fullPath, 'workflow.ts');
    if (existsSync(workflowPath)) {
      try {
        const content = readFileSync(workflowPath, 'utf8');
        // Look for export const <name> = workflow(
        const match = content.match(/export\s+(?:const\s+)?(\w+)\s*=\s*workflow\s*\(/);
        if (match) {
          workflowExports.push({ dir, relativePath, exportName: match[1] });
        } else {
          // Check for default export
          if (content.includes('export default') && content.includes('workflow(')) {
            workflowExports.push({ dir, relativePath, exportName: 'default' });
          }
        }
      } catch (error) {
        console.error(`Error reading ${workflowPath}:`, error);
      }
    }
  }
  
  // Generate workflow keys map for backward compatibility
  const workflowKeys: { [key: string]: string } = {};
  workflowExports.forEach(({ dir, relativePath }) => {
    // Convert workflow directory name to camelCase key
    const key = dir.replace(/^default-/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const workflowId = dir; // This should match the workflow ID from the workflow file
    workflowKeys[key] = workflowId;
  });

  const loaderContent = `/**
 * Auto-generated workflow loader
 * DO NOT EDIT MANUALLY - Run 'pnpm xnovu workflow generate' to update
 */

// Import all workflows
${workflowExports.map(({ dir, relativePath, exportName }) => {
    if (exportName === 'default') {
      return `import ${dir.replace(/-/g, '')}Workflow from "./workflows/${relativePath}/workflow";`;
    } else {
      return `import { ${exportName} } from "./workflows/${relativePath}/workflow";`;
    }
  }).join('\n')}

// Workflow keys for easy reference
export const WORKFLOW_KEYS = {
${Object.entries(workflowKeys).map(([key, value]) => `  ${key}: '${value}',`).join('\n')}
} as const;

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
  
  workflowDirs.forEach(({ dir, fullPath, relativePath }) => {
    const metadataPath = join(fullPath, 'metadata.ts');
    if (existsSync(metadataPath)) {
      const exportName = extractMetadataExportName(metadataPath);
      if (exportName) {
        metadataImports.push(`import { ${exportName} } from "./workflows/${relativePath}/metadata";`);
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