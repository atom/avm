import * as path from 'path';
import * as fs from 'fs';

import './support';
import { expect } from 'chai';

import { isPathSymbolicLink, createSymbolicLink } from '../src/win32-symlink';

describe('The isSymlink method', function() {
  it('detects regular files as not symlinks', function() {
    let input = path.resolve(__dirname, '..', 'package.json');

    expect(isPathSymbolicLink(input)).to.equal(false);
  });

  it('detects regular directories as not symlinks', function() {
    let input = path.resolve(__dirname);

    expect(isPathSymbolicLink(input)).to.equal(false);
  });

  it('throws on bogus paths', function() {
    let input = 'C:\\WEFIowjeafaoiwejfawenfaowefnaowiefwaeof';

    expect(() => isPathSymbolicLink(input)).to.throw();
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
      expect(fs.existsSync(path.join(targetFolder, 'win32-symlink.ts'))).to.be.true;
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