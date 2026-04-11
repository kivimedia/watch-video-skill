import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';

const program = new Command()
  .name('cutsense')
  .description('CutSense - AI Video Understanding & Programmatic Editing Engine')
  .version('0.1.0');

program.addCommand(runCommand);
program.addCommand(statusCommand);

program.parse();
