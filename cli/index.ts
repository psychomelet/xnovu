#!/usr/bin/env tsx

import { Command } from 'commander';
import { config } from 'dotenv';
import { createDockerCommands } from './commands/docker.js';
import { createSupabaseCommands } from './commands/supabase.js';
import { createDevCommands } from './commands/dev.js';
import { createStatusCommands } from './commands/status.js';
import { createDaemonCommands } from './commands/daemon.js';

config();

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
createDaemonCommands(program);

// Parse command line arguments
program.parse();