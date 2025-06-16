import { Command } from 'commander';
import { syncWorkflows } from '../sync.js';

export function createSyncCommands(program: Command) {
  const sync = program
    .command('sync')
    .description('Sync workflows to Novu Cloud and database');

  sync
    .command('workflows')
    .description('Sync all workflows to Novu Cloud and Supabase database')
    .action(async () => {
      try {
        await syncWorkflows();
      } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
      }
    });

  // Alias for convenience
  sync
    .action(async () => {
      try {
        await syncWorkflows();
      } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
      }
    });
}