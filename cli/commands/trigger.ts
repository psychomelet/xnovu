import { Command } from 'commander';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { z } from 'zod';
import { getWorkflowDefaults, mergePayloadWithDefaults } from '../utils/workflow-defaults';
import type { Database } from '@/lib/supabase/database.types';

config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing Supabase configuration. Please check your .env file.'));
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'notify' }
});

interface TriggerOptions {
  subscriber?: string;
  sync?: boolean;
  async?: boolean;
  payload?: string;
  schedule?: string;
  interactive?: boolean;
  list?: boolean;
}

// Helper function to parse JSON payload
function parsePayload(payloadString: string): Record<string, any> | null {
  try {
    return JSON.parse(payloadString);
  } catch (error) {
    console.error(chalk.red('❌ Invalid JSON payload:'), error.message);
    return null;
  }
}

// Helper function to list available workflows
async function listWorkflows() {
  const spinner = ora('Fetching available workflows...').start();
  
  try {
    const { data: workflows, error } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('workflow_key, name, description, workflow_type, default_channels')
      .order('workflow_key');

    spinner.stop();

    if (error) {
      console.error(chalk.red('❌ Error fetching workflows:'), error.message);
      return;
    }

    console.log(chalk.bold('\n📋 Available Workflows:\n'));
    
    // Group by type
    const staticWorkflows = workflows?.filter(w => w.workflow_type === 'STATIC') || [];
    const dynamicWorkflows = workflows?.filter(w => w.workflow_type === 'DYNAMIC') || [];
    
    if (staticWorkflows.length > 0) {
      console.log(chalk.blue('Static Workflows:'));
      staticWorkflows.forEach(w => {
        console.log(`  ${chalk.green(w.workflow_key.padEnd(30))} - ${w.name}`);
        console.log(`    ${chalk.gray(w.description || 'No description')}`);
        console.log(`    ${chalk.gray('Channels:')} ${(w.default_channels || []).join(', ')}\n`);
      });
    }
    
    if (dynamicWorkflows.length > 0) {
      console.log(chalk.blue('\nDynamic Workflows:'));
      dynamicWorkflows.forEach(w => {
        console.log(`  ${chalk.green(w.workflow_key.padEnd(30))} - ${w.name}`);
        console.log(`    ${chalk.gray(w.description || 'No description')}`);
        console.log(`    ${chalk.gray('Channels:')} ${(w.default_channels || []).join(', ')}\n`);
      });
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('❌ Error:'), error.message);
  }
}

// Helper function to trigger notification via API
async function triggerViaApi(workflowKey: string, payload: any, subscriberId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:${process.env.PORT || 3000}`;
  const endpoint = `${apiUrl}/api/trigger`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflowId: workflowKey,
      to: subscriberId,
      payload: payload
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${error}`);
  }

  return await response.json();
}

// Helper function to trigger notification via database
async function triggerViaDatabase(
  workflowId: number,
  workflowKey: string,
  payload: any,
  subscriberId: string,
  scheduledFor?: string
) {
  const notificationData = {
    name: `CLI Trigger: ${workflowKey} - ${new Date().toISOString()}`,
    notification_workflow_id: workflowId,
    payload: payload,
    recipients: [subscriberId],
    enterprise_id: process.env.DEFAULT_ENTERPRISE_ID || '00000000-0000-0000-0000-000000000001',
    notification_status: 'PENDING' as const,
    publish_status: 'PUBLISH' as const,
    transaction_id: uuidv4(),
    scheduled_for: scheduledFor || null,
    overrides: {}
  };

  const { data, error } = await supabase
    .schema('notify')
    .from('ent_notification')
    .insert(notificationData)
    .select()
    .single();

  if (error) {
    throw new Error(`Database insert failed: ${error.message}`);
  }

  return data;
}

// Helper function for interactive mode
async function interactiveMode() {
  // First, get list of workflows
  const { data: workflows, error } = await supabase
    .schema('notify')
    .from('ent_notification_workflow')
    .select('workflow_key, name, description, workflow_type')
    .order('workflow_key');

  if (error || !workflows || workflows.length === 0) {
    console.error(chalk.red('❌ No workflows found'));
    return null;
  }

  const workflowChoices = workflows.map(w => ({
    title: `${w.name} (${w.workflow_key})`,
    value: w.workflow_key,
    description: w.description
  }));

  const response = await prompts([
    {
      type: 'select',
      name: 'workflowKey',
      message: 'Select a workflow to trigger',
      choices: workflowChoices
    },
    {
      type: 'text',
      name: 'subscriberId',
      message: 'Enter subscriber ID (or press enter for default)',
      initial: ''
    },
    {
      type: 'select',
      name: 'mode',
      message: 'Select trigger mode',
      choices: [
        { title: 'Async (via database)', value: 'async' },
        { title: 'Sync (direct API)', value: 'sync' }
      ],
      initial: 0
    },
    {
      type: 'confirm',
      name: 'useDefaults',
      message: 'Use default payload values?',
      initial: true
    },
    {
      type: prev => prev === false ? 'text' : null,
      name: 'customPayload',
      message: 'Enter custom payload (JSON)',
      initial: '{}'
    },
    {
      type: 'confirm',
      name: 'schedule',
      message: 'Schedule for later?',
      initial: false
    },
    {
      type: prev => prev === true ? 'text' : null,
      name: 'scheduleTime',
      message: 'Enter schedule time (YYYY-MM-DD HH:MM:SS)',
      initial: new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ')
    }
  ]);

  return response;
}

// Main trigger function
async function triggerNotification(workflowKey: string, options: TriggerOptions) {
  const spinner = ora('Preparing notification trigger...').start();
  
  try {
    // Get subscriber ID
    const subscriberId = options.subscriber || 
      process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID || 
      'default-cli-subscriber';
    
    if (!options.subscriber && !process.env.NEXT_PUBLIC_NOVU_SUBSCRIBER_ID) {
      spinner.warn(chalk.yellow('⚠️  No subscriber ID provided, using default: default-cli-subscriber'));
    }

    // Lookup workflow
    spinner.text = 'Looking up workflow...';
    const { data: workflow, error: workflowError } = await supabase
      .schema('notify')
      .from('ent_notification_workflow')
      .select('*')
      .eq('workflow_key', workflowKey)
      .single();

    if (workflowError || !workflow) {
      spinner.fail(chalk.red(`❌ Workflow not found: ${workflowKey}`));
      console.log(chalk.yellow('\n💡 Tip: Use --list to see available workflows'));
      return;
    }

    // Prepare payload
    spinner.text = 'Preparing payload...';
    let payload = getWorkflowDefaults(workflowKey);
    
    if (options.payload) {
      const customPayload = parsePayload(options.payload);
      if (!customPayload) {
        spinner.fail('Invalid payload JSON');
        return;
      }
      payload = mergePayloadWithDefaults(workflowKey, customPayload);
    }

    // Determine trigger mode
    const isSync = options.sync || false;
    const mode = isSync ? 'sync' : 'async';
    
    spinner.text = `Triggering notification (${mode} mode)...`;

    let result;
    if (isSync) {
      // Sync mode - direct API call
      result = await triggerViaApi(workflowKey, payload, subscriberId);
      spinner.succeed(chalk.green('✅ Notification triggered successfully (sync mode)'));
      
      console.log(chalk.gray('\n📊 Result:'));
      console.log(chalk.gray('  Transaction ID:'), result.transactionId || 'N/A');
      console.log(chalk.gray('  Status:'), 'Sent directly');
    } else {
      // Async mode - database insertion
      const scheduledFor = options.schedule ? 
        new Date(options.schedule).toISOString() : 
        undefined;
        
      result = await triggerViaDatabase(
        workflow.id,
        workflowKey,
        payload,
        subscriberId,
        scheduledFor
      );
      
      spinner.succeed(chalk.green('✅ Notification created successfully (async mode)'));
      
      console.log(chalk.gray('\n📊 Notification Details:'));
      console.log(chalk.gray('  ID:'), result.id);
      console.log(chalk.gray('  Status:'), result.notification_status);
      console.log(chalk.gray('  Transaction ID:'), result.transaction_id);
      if (scheduledFor) {
        console.log(chalk.gray('  Scheduled for:'), new Date(scheduledFor).toLocaleString());
      }
      
      // Monitor status for a few seconds
      if (!scheduledFor) {
        console.log(chalk.gray('\n⏳ Monitoring status...'));
        
        let attempts = 0;
        const maxAttempts = 10;
        let lastStatus = result.notification_status;
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const { data: updated } = await supabase
            .schema('notify')
            .from('ent_notification')
            .select('notification_status')
            .eq('id', result.id)
            .single();
          
          if (updated && updated.notification_status !== lastStatus) {
            console.log(chalk.gray(`  Status changed: ${lastStatus} → ${updated.notification_status}`));
            lastStatus = updated.notification_status;
            
            if (updated.notification_status === 'SENT' || updated.notification_status === 'FAILED') {
              break;
            }
          }
          
          attempts++;
        }
      }
    }

    console.log(chalk.gray('\n📌 Workflow:'), workflow.name);
    console.log(chalk.gray('📌 Subscriber:'), subscriberId);
    console.log(chalk.gray('📌 Channels:'), (workflow.default_channels || []).join(', '));
    
  } catch (error) {
    spinner.fail(chalk.red('❌ Error triggering notification'));
    console.error(chalk.red('Error details:'), error.message);
    process.exit(1);
  }
}

export function createTriggerCommands(program: Command) {
  program
    .command('trigger [workflow]')
    .description('Trigger a notification workflow')
    .option('-s, --subscriber <id>', 'Subscriber ID (defaults to env var NEXT_PUBLIC_NOVU_SUBSCRIBER_ID)')
    .option('--sync', 'Use sync mode (immediate trigger via API)')
    .option('--async', 'Use async mode via database (default)')
    .option('-p, --payload <json>', 'Custom payload JSON')
    .option('--schedule <datetime>', 'Schedule for future (YYYY-MM-DD HH:MM:SS)')
    .option('-i, --interactive', 'Interactive mode')
    .option('-l, --list', 'List all available workflows')
    .action(async (workflow: string | undefined, options: TriggerOptions) => {
      try {
        // Handle list option
        if (options.list) {
          await listWorkflows();
          return;
        }

        // Handle interactive mode
        if (options.interactive || !workflow) {
          const interactiveOptions = await interactiveMode();
          if (!interactiveOptions || !interactiveOptions.workflowKey) {
            console.log(chalk.yellow('❌ Cancelled'));
            return;
          }
          
          // Map interactive options to command options
          workflow = interactiveOptions.workflowKey;
          options.subscriber = interactiveOptions.subscriberId || options.subscriber;
          options.sync = interactiveOptions.mode === 'sync';
          
          if (!interactiveOptions.useDefaults && interactiveOptions.customPayload) {
            options.payload = interactiveOptions.customPayload;
          }
          
          if (interactiveOptions.schedule && interactiveOptions.scheduleTime) {
            options.schedule = interactiveOptions.scheduleTime;
          }
        }

        if (!workflow) {
          console.error(chalk.red('❌ Please specify a workflow key or use --interactive mode'));
          console.log(chalk.yellow('\n💡 Examples:'));
          console.log(chalk.gray('  pnpm xnovu trigger default-email'));
          console.log(chalk.gray('  pnpm xnovu trigger --list'));
          console.log(chalk.gray('  pnpm xnovu trigger --interactive'));
          process.exit(1);
        }

        await triggerNotification(workflow, options);
      } catch (error) {
        console.error(chalk.red('❌ Unexpected error:'), error.message);
        process.exit(1);
      }
    });
}