import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parse as parseHtml, INode, SyntaxKind } from '@jingeweb/html5parser';
import yargs from 'yargs';
// eslint-disable-next-line import/no-unresolved
import { stringify as csvStringify } from 'csv-stringify/sync';
// eslint-disable-next-line import/no-unresolved
import { parse as csvParse } from 'csv-parse/sync';
const CWD = process.cwd();
const TranslateDir = path.join(CWD, 'translate');

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

function needTranslate(cnt: string) {
  return /[\u4e00-\u9fa5]/.test(cnt);
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
  // let tmap = data.map.get(rf);
  // if (!tmap) {
  //   tmap = new Map();
  //   data.map.set(rf, tmap);
  // }
  const map = new Map();
  function pushRow(text: string) {
    // if (!tmap.has(text)) {
    //   tmap.set(text, {});
    // }
    if (!map.has(text)) {
      // 单文件内相同文案合并为一行
      data.rows.push([rf, text]);
      map.set(text, true);
    }
  }
  function walkNode(node: INode) {
    if (node.type === SyntaxKind.Text) {
      const text = node.value.trim();
      if (needTranslate(text)) {
        pushRow(text);
      }
    } else if (node.name !== '!--') {
      node.attributes.forEach((iattr) => {
        const v = iattr.value?.value.trim();
        if (!v || !needTranslate(v)) return;
        pushRow(v);
      });
      if (node.rawName === '_t') {
        let text = cnt.substring(node.open.end, node.close.start).trim();
        if (!needTranslate(text)) {
          return;
        }
        if (text.indexOf('\n') >= 0) text = text.replace(/\n/g, '');
        pushRow(text);
      } else {
        node.body.forEach((cn) => walkNode(cn));
      }
    }
  }
  inodes.forEach((node) => walkNode(node));
  console.log(`  ${rf}, ${data.rows.length - pn} rows`);
}

function run() {
  const argv = yargs
    .option('scan', {
      alias: 's',
      array: true,
      demandOption: true,
      describe: 'directories to scan',
    })
    .option('locale', {
      alias: 'l',
      array: true,
      demandOption: true,
      describe: 'target locales to translate',
    })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    .version(require('../../package.json').version)
    .alias('version', 'v')
    .help()
    .example("i18n-extract --scan './src' --locale en", 'scan src directory and mark en as traget locale')
    .example(
      'i18n-extract --scan src src2 --locale en jp',
      'scan src and src2 directories and mark en and jp as traget locales',
    )
    .alias('help', 'h').argv as unknown as {
    scan: string[];
    locale: string[];
  };

  // console.log(argv);

  const files = argv.scan.reduce((p, c) => p.concat(glob(path.resolve(CWD, c))), []);
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
      columns: ['source', 'zh_cn'],
      header: true,
    }),
  );
  console.log('zh_cn.csv writed,', data.rows.length, 'total rows.');
  argv.locale.forEach((locale) => {
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
          if (tmap.has(origRow.zh_cn)) {
            throw new Error(`duplicated zh_cn text at line ${i + 1}`);
          }
          tmap.set(origRow.zh_cn, origRow.en);
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
        columns: ['source', 'zh_cn', locale],
        header: true,
      }),
    );
    console.log(`${locale}.csv writed, ${tn} rows to translate.`);
  });
}
run();
