import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
// eslint-disable-next-line import/no-unresolved
import { stringify as csvStringify } from 'csv-stringify/sync';
// eslint-disable-next-line import/no-unresolved
import { parse as csvParse } from 'csv-parse/sync';
import { CWD, TranslateDir } from '../util';
import { extractHtmlFile } from './html';
import { SourceData } from './common';
import { glob } from './helper';
import { extractJsFile } from './js';
import { extractTsFile } from './ts';

export function extract({ scanDirs, targetLocales }: { scanDirs: string[]; targetLocales: string[] }) {
  // console.log(argv);

  const files = scanDirs.reduce((p, c) => p.concat(glob(path.resolve(CWD, c))), []);
  // console.log(files);
  console.log('start scanning', files.length, 'files...');
  const data: SourceData = {
    rows: [],
    // map: new Map(),
  };
  files.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8');
    switch (path.extname(file)) {
      case '.html':
        extractHtmlFile(content, file, data);
        break;
      case '.js':
        extractJsFile(content, file, data);
        break;
      case '.ts':
        extractTsFile(content, file, data);
      default:
        break;
    }
  });
  console.log('scanning done.');
  if (data.rows.length <= 0) return;
  execSync(`mkdir -p ${TranslateDir}`);
  fs.writeFileSync(
    path.join(TranslateDir, 'zh_cn.csv'),
    csvStringify(data.rows, {
      columns: ['source', 'original'],
      header: true,
    }),
  );
  console.log('zh_cn.csv writed,', data.rows.length, 'total rows.');
  targetLocales.forEach((locale) => {
    const lf = path.join(TranslateDir, `${locale}.csv`);
    const map = new Map();
    try {
      const origRows = csvParse(fs.readFileSync(lf), {
        columns: true,
      }) as Record<string, unknown>[];
      origRows.length > 0 &&
        origRows.forEach((origRow, i) => {
          let tmap = map.get(origRow.source);
          if (!tmap) {
            map.set(origRow.source, (tmap = new Map()));
          }
          if (tmap.has(origRow.original)) {
            throw new Error(`duplicated original text at line ${i + 1}`);
          }
          tmap.set(origRow.original, origRow.translate);
        });
    } catch (ex) {
      if (ex.code !== 'ENOENT') throw ex;
    }
    let tn = 0;
    const rows = data.rows.map((row) => {
      const t = map.get(row[0])?.get(row[1]) || '';
      if (!t) tn++;
      return [...row, t];
    });

    fs.writeFileSync(
      lf,
      csvStringify(rows, {
        columns: ['source', 'original', 'translate'],
        header: true,
      }),
    );
    console.log(`${locale}.csv writed, ${tn} rows to translate.`);
  });
}
