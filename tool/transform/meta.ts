import { readFileSync } from 'fs';
import path from 'path';
import { MetaJSON } from '../generate';
import { TranslateDir } from '../util';

let meta: MetaJSON;

export function getMeta() {
  if (meta) return meta;
  const metafile = path.join(TranslateDir, 'meta.json');
  console.log(metafile);
  try {
    meta = JSON.parse(readFileSync(metafile, 'utf-8')) as typeof meta;
    return meta;
  } catch (ex) {
    console.error('meta.json not found, you may need run jinge-i18n generate first');
    process.exit(-1);
  }
}
