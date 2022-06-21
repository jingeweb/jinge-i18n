import path from 'path';
import { promises as fs } from 'fs';
import { parse as _parsecsv } from 'csv-parse';

interface CSVRecord {
  source: string;
  zh_cn: string;
  [k: string]: string;
}
interface Dict {
  rows: CSVRecord[];
  varIdxMap: Map<string, number>;
}

export const DICT_FILENAME = 'dict.5ed9693c7c2e.js';

function parseCsv(cnt: string | Buffer) {
  return new Promise<CSVRecord[]>((resolve, reject) => {
    _parsecsv(cnt, { columns: true }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

const csv: { p?: Promise<unknown>; d?: { map: Map<string, unknown>; dict: string } } = {};
export async function loadDict() {
  if (csv.d) return csv.d;
  if (!csv.p) {
    csv.p = doLoadDict();
  }
  await csv.p;
  return csv.d;
}

async function doLoadDict() {
  const translateDir = path.join(process.cwd(), 'translate');
  const files = (await fs.readdir(translateDir)).filter((f) => f.endsWith('.csv'));
  if (!files.some((f) => f === 'zh_cn.csv')) throw new Error('zh_cn.csv not found.');
  const targetLocales = files.map((f) => path.basename(f, '.csv')).filter((l) => l !== 'zh_cn');
  if (targetLocales.length <= 0) throw new Error('no traget locale csv found.');
  const dicts: Record<string, Dict> = {};
  for await (const f of files) {
    const locale = path.basename(f, '.csv');
    const rows = await fs.readFile(path.join(translateDir, f)).then((buf) => parseCsv(buf));
    dicts[locale] = {
      rows,
      varIdxMap: new Map(),
    };
  }
  const defaultLocaleMap = new Map();
  const generateOutput: string[] = ["import { TComponent, TPComponent, getLocale } from 'jinge-i18n';"];
  targetLocales.length > 1 &&
    targetLocales.forEach((loc) => {
      generateOutput.push(`const ${loc.toUpperCase()} = '${loc}';`);
    });

  const varMap = dicts.zh_cn.varIdxMap;
  dicts.zh_cn.rows.forEach((row, i) => {
    let tmap = defaultLocaleMap.get(row.source);
    if (!tmap) {
      tmap = new Map();
      defaultLocaleMap.set(row.source, tmap);
    }
    if (!varMap.has(row.zh_cn)) {
      const i = varMap.size;
      varMap.set(row.zh_cn, i);
      generateOutput.push(`export const zh_cn_${i} = "${row.zh_cn}";`);
    }
    if (!tmap.has(row.zh_cn)) {
      tmap.set(row.zh_cn, {});
    } else {
      console.error(`[warning] duplicated text at line ${i + 1} in zh_cn.csv`);
    }
  });
  targetLocales.forEach((locale) => {
    const varMap = dicts[locale].varIdxMap;
    dicts[locale].rows.forEach((row, i) => {
      const dict = defaultLocaleMap.get(row.source)?.get(row.zh_cn);
      if (!dict) {
        console.error(
          `[warning] text at line ${i + 1} in ${locale}.csv not found in zh_cn.csv, you may need run i18n-extract.`,
        );
        return;
      }
      const t = row[locale];
      if (!varMap.has(t)) {
        const i = varMap.size;
        varMap.set(t, i);
        generateOutput.push(`export const ${locale}_${i} = "${t}";`);
      }
      dict[locale] = t;
    });
  });
  // await fs.writeFile(path.join(translateDir, 'dict.js'), generateOutput.join('\n'));
  return {
    map: defaultLocaleMap,
    dict: generateOutput.join('\n'),
  };
}
