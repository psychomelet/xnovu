#!/usr/bin/env tsx

import { Command } from 'commander';
import { config } from 'dotenv';
import { createDockerCommands } from './commands/docker.js';
import { createSupabaseCommands } from './commands/supabase.js';
import { createDevCommands } from './commands/dev.js';
import { createStatusCommands } from './commands/status.js';

// Load .env files with proper override precedence
// Load .env first (base/default values)
config({ path: '.env' });
// Load .env.local second with override enabled (overrides .env values)
config({ path: '.env.local', override: true });

const program = new Command();

program
  .name('xnovu')
  .description('XNovu CLI - Internal notification system management tools')
  .version('0.1.0');

// Register all command modules
createSupabaseCommands(program);
createDevCommands(program);
createDockerCommands(program);
createStatusCommands(program);

// Parse command line arguments
program.parse();