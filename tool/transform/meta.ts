import { readFileSync } from 'fs';
import path from 'path';
import { MetaJSON } from '../generate/common';
import { TranslateMetaDir } from '../util';

let meta: MetaJSON;

export function getMeta() {
  if (meta) return meta;
  meta = {} as unknown as MetaJSON;
  ['attribute', 'dictionary'].forEach((name) => {
    const metafile = path.join(TranslateMetaDir, name + '.json');
    // console.log(metafile);
    try {
      meta[name as unknown as keyof MetaJSON] = JSON.parse(readFileSync(metafile, 'utf-8'));
      return meta;
    } catch (ex) {
      console.error(`failed load "meta/${name}.json", you may need re-run jinge-i18n generate`);
      process.exit(-1);
    }
  });
  return meta;
}
