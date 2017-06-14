import * as commander from 'commander';

let hasRunCommand = false;

export function switchVersion(channel: string) {
  hasRunCommand = true;
  console.log(`Switch! ${channel}`);
}

export function displayVersion() {
  hasRunCommand = true;
  console.log('Display!');
}

export function removeVersion(channel: string) {
  hasRunCommand = true;
  console.log(`Remove! ${channel}`);
}

// tslint:disable-next-line:no-var-requires
commander.version(require('../package.json').version);

commander
  .command('switch [channel]').alias('s')
  .description('Switch between installed versions of Atom')
  .action(switchVersion);

commander
  .command('info').alias('i')
  .description('List the installed channels and your current channel')
  .action(displayVersion);

commander
  .command('remove [channel]').alias('r')
  .description('Remove an installed channel to save disk space')
  .action(removeVersion);

commander.parse(process.argv);

if (!hasRunCommand) {
  displayVersion();
  process.exit(0);
}