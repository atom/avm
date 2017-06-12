import * as ffi from 'ffi';
import * as ref from 'ref';
import * as fs from 'fs';

const FILE_ATTRIBUTE_REPARSE_POINT = 0x400;

function TEXT(str: string) {
  const ret = Buffer.alloc((str.length + 1) * 4);
  Buffer.from(str, 'ucs2').copy(ret);

  return ret;
}

const SYMBOLIC_LINK_FLAG_FILE = 0x0;
const SYMBOLIC_LINK_FLAG_DIRECTORY = 0x1;
const SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE = 0x2;

const kernel32 = ffi.Library('kernel32', {
  CreateSymbolicLinkW: [ ref.types.int32, [ 'string', 'string', ref.types.int32 ]],
  GetFileAttributesW: [ ref.types.int32, [ 'string' ]],
  GetLastError: [ ref.types.int32, []]
});

export function isPathSymbolicLink(filePath: string) {
  let ret = kernel32.GetFileAttributesW(TEXT(filePath));

  if (ret === -1) {
    // TODO: This sucks
    let gle = kernel32.GetLastError();
    throw new Error(`isFileSymlink failed: ${gle}`);
  }

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