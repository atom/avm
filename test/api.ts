import * as path from 'path';
//import * as fs from 'fs';

import './support';
import { expect } from 'chai';

import { findLatestFullNugetFromReleasesFile } from '../src/api';

describe.only('the findLatestFullNugetFromReleasesFile function', function() {
  it('parses our easy fixture RELEASES file', function() {
    let input = path.join(__dirname, '..', 'fixtures', 'RELEASES');
    let result = findLatestFullNugetFromReleasesFile(input);

    expect(result).to.equal('trickline-0.0.2-full.nupkg');
  });

  it('parses our harder fixture RELEASES file', function() {
    let input = path.join(__dirname, '..', 'fixtures', 'RELEASES-atombeta');
    let result = findLatestFullNugetFromReleasesFile(input);

    expect(result).to.equal('atom-1.18.0-beta3-full.nupkg');
  });
});