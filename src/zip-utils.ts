import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as yauzl from 'yauzl';

import * as download from 'download';
import * as temp from 'temp';

temp.track();

export function extractSingleFile(zipPath: string, relativePath: string, targetPath: string): Promise<any> {
  return new Promise((res, rej) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: Error, zipFile: any) => {
      if (err) {
        rej(err);
        return;
      }

      zipFile.on('entry', (entry: any) => {
        if (entry.fileName.toLowerCase() !== relativePath.toLowerCase()) { zipFile.readEntry(); return; }

        const target = fs.createWriteStream(targetPath, { flags: 'w', autoClose: true });
        zipFile.openReadStream(entry, (err: Error, readStream: any) => {
          if (err) {
            rej(err);
            return;
          }

          readStream.on('end', () => res());
          readStream.on('error', (err: Error) => rej(err));
          readStream.pipe(target);
        });
      });

      zipFile.readEntry();
    });
  });
}

export async function downloadFileToTempDir(fileUrl: string, existingDir?: string) {
  let targetDir = existingDir || temp.mkdirSync('avm');
  let u = url.parse(fileUrl);
  let ret = path.join(targetDir, path.basename(u.pathname!));

  await download(fileUrl, targetDir);
  return ret;
}