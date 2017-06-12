import * as fs from 'fs';
import * as yauzl from 'yauzl';

export function extractSingleFile(zipPath: string, relativePath: string, targetPath: string): Promise<any> {
  return new Promise((res, rej) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: Error, zipFile: any) => {
      if (err) {
        rej(err);
        return;
      }

      console.log('Opened the file!');
      zipFile.on('entry', (entry: any) => {
        if (entry.fileName.toLowerCase() !== relativePath.toLowerCase()) { zipFile.readEntry(); return; }

        console.log('Found the right file!');
        const target = fs.createWriteStream(targetPath, { flags: 'w', autoClose: true });
        zipFile.openReadStream(entry, (err: Error, readStream: any) => {
          if (err) {
            rej(err);
            return;
          }

          console.log('Opened the stream!');
          readStream.on('end', () => res());
          readStream.on('error', (err: Error) => rej(err));
          readStream.pipe(target);
        });
      });

      zipFile.readEntry();
    });
  });
}

export function downloadFileToTempDir(url: string) {

}