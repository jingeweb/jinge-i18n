import path from 'path';
import fs from 'fs';
// eslint-disable-next-line import/no-unresolved
import { parse as parseCsv } from 'csv-parse/sync';

export interface CSVRecord {
  source: string;
  original: string;
  translate: string;
}

/**
 *        [zh_cn text]
 *              |
 *  [source_1]    [source_2]
 *      |              |
 *  "en"  "jp"     "en" "jp"
 *    |
 *[en text]
 */
export type DictTree = Map<string, Map<string, Map<string, string>>>;
export interface Dict {
  rows: CSVRecord[];
}

export type DictStore = ReturnType<typeof loadDict>;

export function loadDict() {
  const translateDir = path.join(process.cwd(), 'translate');
  const files = fs.readdirSync(translateDir).filter((f) => f.endsWith('.csv'));
  if (!files.some((f) => f === 'zh_cn.csv')) throw new Error('zh_cn.csv not found.');
  const targetLocales = files.map((f) => path.basename(f, '.csv')).filter((l) => l !== 'zh_cn');
  if (targetLocales.length <= 0) throw new Error('no traget locale csv found.');

  const dictTree: DictTree = new Map();
  const sources: Set<string> = new Set();

  const zhRows = parseCsv(fs.readFileSync(path.join(translateDir, 'zh_cn.csv')), { columns: true }) as CSVRecord[];
  zhRows.forEach((row, i) => {
    sources.add(row.source);
    let locMap = dictTree.get(row.original);
    if (!locMap) {
      locMap = new Map();
      dictTree.set(row.original, locMap);
    }
    let txtMap = locMap.get(row.source);
    if (!txtMap) {
      txtMap = new Map();
      locMap.set(row.source, txtMap);
    } else {
      throw new Error(`duplicated zh_cn text at line ${i + 1} in zh_cn.csv`);
    }
  });
  for (const locale of targetLocales) {
    const rows = parseCsv(fs.readFileSync(path.join(translateDir, locale + '.csv')), { columns: true }) as CSVRecord[];
    rows.forEach((row, i) => {
      sources.add(row.source);
      const txtMap = dictTree.get(row.original)?.get(row.source);
      if (!txtMap) {
        console.error(`[warning] original zh_cn text at line ${i + 1} in ${locale}.csv not found in zh_cn.csv`);
        return;
      }
      const t = row.translate;
      if (txtMap.has(t)) {
        console.error(`[warning] duplicated translated text at line ${i + 1} in ${locale}.csv`);
      } else {
        txtMap.set(locale, t);
      }
    });
  }
  return {
    tree: dictTree,
    locales: targetLocales,
    files: Array.from(sources),
  };
}
