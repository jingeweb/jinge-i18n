import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse as parseHtml, INode, SyntaxKind } from '@jingeweb/html5parser';
// eslint-disable-next-line import/no-unresolved
import { stringify as csvStringify } from 'csv-stringify/sync';
// eslint-disable-next-line import/no-unresolved
import { parse as csvParse } from 'csv-parse/sync';
import { needTranslate, CWD, TranslateDir } from '../util';

function glob(dir: string) {
  const subs = fs.readdirSync(dir);
  let files: string[] = [];
  subs.forEach((sub) => {
    const fp = path.join(dir, sub);
    const st = fs.statSync(fp);
    if (st.isDirectory()) {
      files = files.concat(glob(fp));
    } else if (/\.(js|ts|html)$/.test(sub)) {
      files.push(fp);
    }
  });
  return files;
}

interface SourceData {
  rows: unknown[][];
  // map: Map<string, Map<string, unknown>>;
}
function extractTemplate(file: string, data: SourceData) {
  const rf = path.relative(CWD, file);
  const cnt = fs.readFileSync(file, 'utf-8');
  const inodes = parseHtml(cnt);
  const pn = data.rows.length;
  const map = new Map();

  const pushRow = (text: string) => {
    if (!map.has(text)) {
      // 单文件内相同文案合并为一行，不支持单文件内相同文案有不同的翻译。
      data.rows.push([rf, text]);
      map.set(text, true);
    }
  };

  const walkNode = (node: INode) => {
    if (node.type === SyntaxKind.Text) {
      const text = node.value.trim();
      if (!text || !needTranslate(text)) return;
      pushRow(text);
    } else if (node.name !== '!--') {
      node.attributes.forEach((iattr) => {
        const v = iattr.value?.value.trim();
        if (!v || !needTranslate(v)) return;
        if (iattr.name.value.includes(':')) {
          // 当前不支持 :a="name + '你好'" 这种表达式属性的多语言抽取，可改为 a="${name}你好"。
          console.error(
            `[warning] expression attribute won\'t be extract, please use string attribute instead.\n  --> ${path.relative(
              CWD,
              file,
            )}, Ln ${iattr.value.loc.start.line}, Col ${iattr.value.loc.start.column}`,
          );
          return;
        }
        pushRow(v);
      });
      if (node.rawName === '_t') {
        let text = cnt.substring(node.open.end, node.close.start).trim();
        if (!text || !needTranslate(text)) {
          return;
        }
        if (text.indexOf('\n') >= 0) text = text.replace(/\n/g, '');
        pushRow(text);
      } else {
        node.body?.forEach((cn) => walkNode(cn));
      }
    }
  };
  inodes.forEach((node) => walkNode(node));
  console.log(`  ${rf}, ${data.rows.length - pn} rows`);
}

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
    if (file.endsWith('.html')) {
      extractTemplate(file, data);
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
