import * as commander from 'commander';

import { getAllInstalledAtomVersions, getInstalledAtomVersionKind,
  getVersionFromInstalledAtom, versionKindToString, AtomVersionKind
} from './api';

let hasRunCommand = false;

export function switchVersion(channel: string) {
  hasRunCommand = true;
  console.log(`Switch! ${channel}`);
}

export function displayVersion() {
  hasRunCommand = true;

  let versions = getAllInstalledAtomVersions();
  let current = getInstalledAtomVersionKind();

  console.log('\nInstalled Atom Versions:\n');

  versions.forEach((dir, ver) => {
    let currentSym = (ver === current) ? '*' : ' ';
    let version = getVersionFromInstalledAtom(dir);
    let name = versionKindToString(ver);

    console.log(`${currentSym} ${name} - ${version}`);
  });

  if (current === AtomVersionKind.Unknown || AtomVersionKind.NotInstalled) {
    console.log('\n*** Currently installed Atom is unknown or not managed by atom-version-manager');
  }
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