import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { ingestCommand } from './commands/ingest.js';
import { understandCommand } from './commands/understand.js';
import { editCommand } from './commands/edit.js';
import { renderCommand } from './commands/render.js';

const program = new Command()
  .name('cutsense')
  .description('CutSense - AI Video Understanding & Programmatic Editing Engine')
  .version('0.1.0');

program.addCommand(runCommand);
program.addCommand(ingestCommand);
program.addCommand(understandCommand);
program.addCommand(editCommand);
program.addCommand(renderCommand);
program.addCommand(statusCommand);

program.parse();
