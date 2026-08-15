import figlet from 'figlet';
import chalk from 'chalk';

export function banner() {
  return chalk.blue(figlet.textSync('GRAPHSPEC', {
    horizontalLayout: 'fitted',
    verticalLayout: 'fitted',
    font: 'Sub-Zero'
  }));
}
