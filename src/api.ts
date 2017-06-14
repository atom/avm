import * as fs from 'graceful-fs';
import * as path from 'path';

import * as rimraf from 'rimraf';
import * as semver from 'semver';

import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/defer';
import 'rxjs/add/observable/timer';

import 'rxjs/add/operator/retry';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/toPromise';

import { createSymbolicLink, isPathSymbolicLink } from './win32-symlink';
import { spawnPromise } from 'spawn-rx';
import { downloadFileToTempDir, extractSingleFile } from './zip-utils';

export enum AtomVersionKind {
  NotInstalled,
  Unknown,
  Stable,
  Beta,
  Daily
}

export function versionKindToString(kind: AtomVersionKind) {
  switch (kind) {
  case AtomVersionKind.NotInstalled:
    return 'not installed';
  case AtomVersionKind.Unknown:
    return 'unknown';
  case AtomVersionKind.Stable:
    return 'stable';
  case AtomVersionKind.Beta:
    return 'beta';
  case AtomVersionKind.Daily:
    return 'canary';
  }
}

export function stringToVersionKind(kind: string) {
  switch (kind) {
  case 'stable':
    return AtomVersionKind.Stable;
  case 'beta':
    return AtomVersionKind.Beta;
  case 'canary':
    return AtomVersionKind.Daily;
  default:
    throw new Error('Not a valid version kind');
  }
}

export function getInstalledAtomVersionKind(baseDir?: string): AtomVersionKind {
  let atomDir = path.join(baseDir || process.env['LOCALAPPDATA'], 'atom');

  if (!fs.existsSync(atomDir)) {
    return AtomVersionKind.NotInstalled;
  }

  if (!isPathSymbolicLink(atomDir)) {
    return AtomVersionKind.Unknown;
  }

  return directoryNameToAtomVersionKind(atomDir);
}

export function getAllInstalledAtomVersions(baseDir?: string): Map<AtomVersionKind, string> {
  let dir = baseDir || process.env['LOCALAPPDATA'];

  return fs.readdirSync(dir).reduce((acc, x) => {
    let fullPath = path.join(dir, x);
    let kind = directoryNameToAtomVersionKind(fullPath);
    if (kind === AtomVersionKind.Unknown) { return acc; }

    acc.set(kind, fullPath);
    return acc;
  }, new Map<AtomVersionKind, string>());
}

export function getVersionFromInstalledAtom(atomDir: string) {
  let entries = fs.readdirSync(atomDir);

  return entries.reduce((acc, x) => {
    let m = x.match(/^app-(.*)$/i);
    if (!m) { return acc; }

    return semver.gte(acc, m[1]) ? acc : m[1];
  }, '0.0.0');
}

export async function uninstallCurrentAtom(baseDir?: string, forceUninstall?: boolean) {
  let atomDir = path.join(baseDir || process.env['LOCALAPPDATA'], 'atom');
  if (!fs.existsSync(atomDir)) {
    return;
  }

  await runInstallHookOnCurrentAtom('uninstall', baseDir);

  if (isPathSymbolicLink(atomDir)) {
    fs.rmdirSync(atomDir);
  } else {
    if (!forceUninstall) { return; }
    rimraf.sync(atomDir);
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

export async function cleanInstallAtomVersion(kind: AtomVersionKind, baseDir?: string) {
  let newAtom = getInstalledAtomPath(kind, baseDir);
  let squirrelTemp = path.join(process.env.LOCALAPPDATA, 'SquirrelTemp');

  if (fs.existsSync(squirrelTemp)) {
    rimraf.sync(squirrelTemp);
    fs.mkdirSync(squirrelTemp);
  }

  // NB: Do downloads first, so that if it fails we aren't left with a hosed install
  let nugetPackage = await downloadAtomFromRelease(kind, squirrelTemp);
  let tempDir = path.dirname(nugetPackage);
  let squirrel = path.join(tempDir, 'Update.exe');

  await extractSingleFile(nugetPackage, 'lib/net45/squirrel.exe', squirrel);

  if (fs.existsSync(newAtom)) {
    rimraf.sync(newAtom);
  }

  await uninstallCurrentAtom();

  // NB: Fuck Antivirus
  await Observable.timer(5 * 1000).take(1).toPromise();

  // NB: Antivirus scanners will be busy with this file since we basically
  // just wrote it
  await Observable.defer(() => spawnPromise(squirrel, ['--install', '.', '--silent'], { cwd: tempDir }))
    .retry(10)
    .toPromise();

  // NB: Fuck Antivirus More
  await Observable.timer(5 * 1000).take(1).toPromise();

  await uninstallCurrentAtom();

  let atomDir = path.join(process.env['LOCALAPPDATA'], 'atom');
  fs.renameSync(atomDir, newAtom);
}

export function findLatestFullNugetFromReleasesFile(filePath: string) {
  let lines = fs.readFileSync(filePath, 'utf8').split('\n');
  let ret = lines.reduce((acc, x) => {
    let m = x.match(/[a-zA-Z]+-(.*)-full\.nupkg/);
    if (!m) { return acc; }

    return semver.gte(m[1], acc.version) ? { name: m[0], version: m[1] } : acc;
  }, { name: '', version: '0.0.0' });

  return ret.name;
}

function directoryNameToAtomVersionKind(atomDir: string) {
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

export function getInstalledAtomPath(kind: AtomVersionKind, baseDir?: string) {
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

export async function downloadAtomFromRelease(kind: AtomVersionKind, targetDir: string) {
  let url = 'https://atom.io/api/updates-x64/RELEASES';
  switch (kind) {
  case AtomVersionKind.Stable:
    break;
  case AtomVersionKind.Beta:
    url += '?channel=beta';
    break;
  default:
    throw new Error('Channel not supported');
  }

  let releasesFile = await downloadFileToTempDir(url, targetDir);

  let fileToDownload = findLatestFullNugetFromReleasesFile(releasesFile);
  let urlToDownload = url.replace(/\/RELEASES/, '/' + fileToDownload);

  await downloadFileToTempDir(urlToDownload, targetDir);

  return path.join(targetDir, fileToDownload);
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