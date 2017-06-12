import * as path from 'path';
import * as fs from 'fs';
import * as temp from 'temp';

import './support';
import { expect } from 'chai';
import { extractSingleFile } from '../src/zip-utils';

temp.track();

describe.only('the extractSingleFile function', function() {
  this.timeout(30 * 1000);

  beforeEach(function() {
    this.outPath = temp.mkdirSync('avm');
  });

  it('extracts Squirrel to a temp file', async function() {
    let outFile = path.join(this.outPath, 'Squirrel.exe');
    console.log(`Attempting to write squirrel.exe to ${outFile}`);

    await extractSingleFile(
      path.resolve(__dirname, '..', 'fixtures', 'trickline-0.0.2-full.nupkg'),
      'lib/net45/Squirrel.exe',
      outFile);

    let stats = fs.statSync(outFile);
    expect(stats.isFile()).to.be.true;
    expect(stats.size > 1024).to.be.true;
  });
});