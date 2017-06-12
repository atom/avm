import * as fs from 'fs';
import * as path from 'path';

import * as semver from 'semver';

import { createSymbolicLink, isPathSymbolicLink } from './win32-symlink';
import { spawnPromise } from 'spawn-rx';

export enum AtomVersionKind {
  NotInstalled,
  Unknown,
  Stable,
  Beta,
  Daily
}

export function getInstalledAtomVersionType(baseDir?: string): AtomVersionKind {
  let atomDir = path.join(baseDir || process.env['LOCALAPPDATA'], 'atom');

  if (!fs.existsSync(atomDir)) {
    return AtomVersionKind.NotInstalled;
  }

  if (!isPathSymbolicLink(atomDir)) {
    return AtomVersionKind.Unknown;
  }

  let actualAtomDir = fs.realpathSync(atomDir);
  let m = actualAtomDir.match(/\\avm-atom-(stable|beta|daily)/i);
  if (!m) { return AtomVersionKind.Unknown; }

  switch (m[1]) {
  case 'stable':
    return AtomVersionKind.Stable;
  case 'beta':
    return AtomVersionKind.Beta;
  case 'daily':
    return AtomVersionKind.Daily;
  default:
    return AtomVersionKind.Unknown;
  }
}

export async function uninstallCurrentAtom(baseDir?: string) {
  let atomDir = path.join(baseDir || process.env['LOCALAPPDATA'], 'atom');
  if (!fs.existsSync(atomDir)) {
    return;
  }

  await runInstallHookOnCurrentAtom('uninstall', baseDir);

  if (isPathSymbolicLink(atomDir)) {
    fs.rmdirSync(atomDir);
  }
}

export async function switchToInstalledAtom(kind: AtomVersionKind, baseDir?: string) {
  let newAtom = getInstalledAtomPath(kind, baseDir);
  if (!fs.existsSync(newAtom)) {
    throw new Error(`${newAtom} doesn't exist, so can't switch to it`);
  }

  await uninstallCurrentAtom();

  let linkedAtom = path.join(baseDir || process.env['LOCALAPPDATA'], 'atom');
  createSymbolicLink(newAtom, linkedAtom);

  runInstallHookOnCurrentAtom('install', baseDir);
}

function getCurrentPackageVersion(appDir: string): string {
  let apps = fs.readdirSync(appDir).filter(x => !!x.match(/app-/));
  if (!apps || apps.length < 1) {
    throw new Error(`${appDir} isn't a Squirrel.Windows package`);
  }

  return apps.reduce((acc, x) => {
    let ver = x.replace(/^app-/, '');
    return semver.gte(ver, acc) ? ver : acc;
  }, '0.0.0');
}

function getInstalledAtomPath(kind: AtomVersionKind, baseDir?: string) {
  let dirName;

  switch (kind) {
  case AtomVersionKind.Stable:
    dirName = `avm-atom-stable`;
    break;
  case AtomVersionKind.Beta:
    dirName = `avm-atom-beta`;
    break;
  case AtomVersionKind.Daily:
    dirName = `avm-atom-daily`;
    break;
  default:
    throw new Error(`Can't get installed Atom path for kind: ${kind}`);
  }

  return path.join(baseDir || process.env['LOCALAPPDATA'], dirName);
}

async function runInstallHookOnCurrentAtom(type: string, baseDir?: string) {
  let atomDir = path.join(baseDir || process.env['LOCALAPPDATA'], 'atom');
  if (!fs.existsSync(atomDir)) {
    return;
  }

  let version = getCurrentPackageVersion(atomDir);

  let atomDotExe = path.join(atomDir, `app-${version}`, 'atom.exe');
  await spawnPromise(atomDotExe, [`--squirrel-${type}`, version]);
}