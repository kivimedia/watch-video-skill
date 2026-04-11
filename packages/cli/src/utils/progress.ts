import chalk from 'chalk';

export class ProgressReporter {
  private stepCount = 0;
  private totalSteps: number;

  constructor(totalSteps = 7) {
    this.totalSteps = totalSteps;
  }

  step(name: string, detail?: string): void {
    this.stepCount++;
    const time = this.getIST();
    const prefix = chalk.dim(`[${time}]`);
    const step = chalk.cyan(`Step ${this.stepCount}/${this.totalSteps}`);
    const msg = detail ? `${name}: ${chalk.white(detail)}` : name;
    console.log(`${prefix} ${step} ${msg}`);
  }

  info(msg: string): void {
    const time = this.getIST();
    console.log(`${chalk.dim(`[${time}]`)} ${chalk.blue('INFO')} ${msg}`);
  }

  warn(msg: string): void {
    const time = this.getIST();
    console.log(`${chalk.dim(`[${time}]`)} ${chalk.yellow('WARN')} ${msg}`);
  }

  error(msg: string): void {
    const time = this.getIST();
    console.log(`${chalk.dim(`[${time}]`)} ${chalk.red('ERROR')} ${msg}`);
  }

  cost(usd: number, tokens: number): void {
    console.log(chalk.dim(`  Cost: $${usd.toFixed(4)} | ${tokens.toLocaleString()} tokens`));
  }

  complete(msg: string): void {
    const time = this.getIST();
    console.log(`${chalk.dim(`[${time}]`)} ${chalk.green('DONE')} ${msg}`);
  }

  private getIST(): string {
    return new Date().toLocaleTimeString('en-IL', {
      timeZone: 'Asia/Jerusalem',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }
}
