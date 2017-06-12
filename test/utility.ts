import * as ffi from 'ffi';
import * as ref from 'ref';
import * as path from 'path';
import * as fs from 'fs';

import './support';
import { expect } from 'chai';

const FILE_ATTRIBUTE_REPARSE_POINT = 0x400;

function TEXT(str: string) {
  const ret = Buffer.alloc((str.length + 1) * 4);
  Buffer.from(str, 'ucs2').copy(ret);

  return ret;
}

export const SYMBOLIC_LINK_FLAG_FILE = 0x0;
export const SYMBOLIC_LINK_FLAG_DIRECTORY = 0x1;
export const SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE = 0x2;

const kernel32 = ffi.Library('kernel32', {
  CreateSymbolicLinkW: [ ref.types.int32, [ 'string', 'string', ref.types.int32 ]],
  GetFileAttributesW: [ ref.types.int32, [ 'string' ]],
  GetLastError: [ ref.types.int32, []]
});

export function isFileSymlink(filePath: string) {
  let ret = kernel32.GetFileAttributesW(TEXT(filePath));

  if (ret === -1) {
    // TODO: This sucks
    let gle = kernel32.GetLastError();
    throw new Error(`isFileSymlink failed: ${gle}`);
  }

  console.log(`dwFileAttributes: ${JSON.stringify(ret)}`);
  return (ret & FILE_ATTRIBUTE_REPARSE_POINT) !== 0;
}

export function createSymbolicLink(target: string, link: string) {
  let stat = fs.statSync(target);
  let flags;

  if (stat.isDirectory()) {
    flags = SYMBOLIC_LINK_FLAG_DIRECTORY | SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE;
  } else {
    flags = SYMBOLIC_LINK_FLAG_FILE | SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE;
  }

  let ret = kernel32.CreateSymbolicLinkW(TEXT(link), TEXT(target), flags);
  if (ret === 0) {
    // TODO: This sucks
    let gle = kernel32.GetLastError();
    throw new Error(`createSymbolicLink failed: ${gle}`);
  }
}

describe('The isSymlink method', function() {
  it('detects regular files as not symlinks', function() {
    let input = path.resolve(__dirname, '..', 'package.json');

    expect(isFileSymlink(input)).to.equal(false);
  });

  it('detects regular directories as not symlinks', function() {
    let input = path.resolve(__dirname);

    expect(isFileSymlink(input)).to.equal(false);
  });

  it('throws on bogus paths', function() {
    let input = 'C:\\WEFIowjeafaoiwejfawenfaowefnaowiefwaeof';

    expect(() => isFileSymlink(input)).to.throw();
  });
});

describe('The createSymbolicLink method', function() {
  it('creates symbolic links to directories', function() {
    let srcFolder = path.resolve(__dirname, '..', 'src');
    let targetFolder = path.resolve(__dirname, '__foobar');

    expect(fs.existsSync(srcFolder)).to.be.true;
    expect(fs.existsSync(targetFolder)).to.be.false;

    createSymbolicLink(srcFolder, targetFolder);

    try {
      expect(fs.existsSync(path.join(targetFolder, 'index.ts'))).to.be.true;
    } finally {
      fs.rmdirSync(targetFolder);
    }
  });

  it('creates symbolic links to files', function() {
    let srcFile = path.resolve(__dirname, '..', 'package.json');
    let targetFile = path.resolve(__dirname, '__foobar2');

    expect(fs.existsSync(srcFile)).to.be.true;
    expect(fs.existsSync(targetFile)).to.be.false;

    createSymbolicLink(srcFile, targetFile);

    try {
      let pkgJson = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
      expect(pkgJson.name).to.equal('atom-version-manager');
    } finally {
      fs.unlinkSync(targetFile);
    }
  });
});