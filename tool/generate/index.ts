import path from 'path';
import fs from 'fs';
import { parse as parseHtml, INode, SyntaxKind } from '@jingeweb/html5parser';
import { needTranslate, TranslateDir } from '../util';
import { loadDict } from './dict';
import { parseExpr } from './parse';
const CWD = process.cwd();

enum TextType {
  /** 不带参数的纯文本，比如 "你好" */
  PURE,
  /** 带参数的文本，比如 "你好${name}" */
  PARAM,
  /** 使用 <_t> 包裹的渲染文本，比如 <_t>你好，<span>xx</span><_t> */
  RENDER,
}
export interface MetaInfo {
  type: TextType;
  index: number;
  translate: Map<string, number>;
}
export type MetaJSON = Record<
  string,
  Record<
    string,
    {
      component: string;
      params?: { expr: string; pi: number }[];
    }
  >
>;
type IdxMap = Map<string, number>;
type MetaIdxMap = Record<MetaInfo['type'], IdxMap>;

function getIndex(indexMap: IdxMap, text: string) {
  if (indexMap.has(text)) return indexMap.get(text);
  const i = indexMap.size + 1;
  indexMap.set(text, i);
  return i;
}
function handleHtml(
  source: string,
  file: string,
  output: {
    meta: MetaJSON;
    store: Set<string>;
    codes: string[];
  },
  meta: Map<string, Map<string, MetaInfo>>,
  dict: ReturnType<typeof loadDict>,
  indeies: Record<string, MetaIdxMap>,
) {
  const logErr = (msg: string, loc: { line: number; column: number }, type: 'warning' | 'error' = 'warning') => {
    console.error(`[${type}] ${msg}\n  --> ${file}, Ln ${loc.line}, Col ${loc.column}`);
  };
  const addOutputCode = (key: string, tf: () => string) => {
    if (output.store.has(key)) return;
    output.store.add(key);
    output.codes.push(`export const ${key} = ${tf()};`);
  };
  const addOutputMeta = (text: string, source: string, varName: string) => {
    let m = output.meta[text];
    if (!m) m = output.meta[text] = {};
    if (m[source]) throw 'unexpected??';
    m[source] = {
      component: varName,
    };
  };
  const targetLocales = dict.locales;
  const inodes = parseHtml(source);
  const walkNode = (node: INode) => {
    if (node.type === SyntaxKind.Text) {
      const text = node.value.trim();
      if (!text || !needTranslate(text)) return;
      const tmap = dict.tree.get(text)?.get(file);
      if (!tmap) {
        logErr('text not found in zh_cn.csv, you may need re-run jinge-i18n extract', node.loc.start);
        return;
      }
      targetLocales.forEach((locale) => {
        if (!tmap.get(locale)) {
          logErr(`${locale} translate missing\n  --> ${JSON.stringify(text)}`, node.loc.start);
          tmap.set(locale, '--miss--');
        }
      });
      const expr = parseExpr(text);
      if (!expr.params) {
        const i = getIndex(indeies.zh_cn[TextType.PURE], text);
        const info: MetaInfo = {
          type: TextType.PURE,
          index: i,
          translate: new Map(),
        };
        addOutputCode(`zh_cn_s${i}`, () => JSON.stringify(text));
        let locs = meta.get(text);
        if (!locs) {
          locs = new Map();
          meta.set(text, locs);
        }
        if (locs.has(file)) throw 'impossible?';
        locs.set(file, info);
        const ii = targetLocales.map((locale) => {
          const tt = tmap.get(locale);
          const ti = getIndex(indeies[locale][TextType.PURE], tt);
          info.translate.set(locale, ti);
          addOutputCode(`${locale}_s${ti}`, () => JSON.stringify(tt));
          return ti;
        });
        const varName = `T${i}_${ii.join('_')}`;
        addOutputMeta(text, file, varName);
        addOutputCode(
          varName,
          () => `class extends TComponent {
  t(locale) { return locale === ZH_CN ? zh_cn_s${i} : ${targetLocales
            .map((loc, li) => {
              const varName = `${loc}_s${info.translate.get(loc)}`;
              return li === targetLocales.length - 1 ? varName : `locale === ${loc.toUpperCase()} ? ${varName} : `;
            })
            .join('')}; }
}`,
        );
      } else {
        throw 'todo';
      }
    } else if (node.name !== '!--') {
      node.attributes.forEach((iattr) => {
        const v = iattr.value?.value.trim();
        if (!v || !needTranslate(v)) return;
        if (iattr.name.value.includes(':')) {
          // 当前不支持 :a="name + '你好'" 这种表达式属性的多语言抽取，可改为 a="${name}你好"。
          console.error(
            `[warning] expression attribute won\'t be extract, please use string attribute instead.\n  --> ${file}, Ln ${iattr.value.loc.start.line}, Col ${iattr.value.loc.start.column}`,
          );
          return;
        }
        throw 'todo';
      });
      if (node.rawName === '_t') {
        let text = source.substring(node.open.end, node.close.start).trim();
        if (!text || !needTranslate(text)) {
          return;
        }
        if (text.indexOf('\n') >= 0) text = text.replace(/\n/g, '');
        throw 'todo';
      } else {
        node.body.forEach((cn) => walkNode(cn));
      }
    }
  };
  inodes.forEach((node) => walkNode(node));
}

export function generate() {
  const dict = loadDict();
  const indices = Object.fromEntries(
    ['zh_cn', ...dict.locales].map((l) => [
      l,
      {
        [TextType.PURE]: new Map(),
        [TextType.PARAM]: new Map(),
        [TextType.RENDER]: new Map(),
      },
    ]),
  );
  const meta = new Map();
  const output = {
    meta: {} as MetaJSON,
    store: new Set() as Set<string>,
    codes: [
      `/** eslint-disabled **/
/**
 * this file is auto generated by jinge-i18n, don't modify manually.
 */
import { TComponent, TPComponent } from "jinge-i18n";
export const ZH_CN = "zh_cn";
${dict.locales.map((loc) => `export const ${loc.toUpperCase()} = "${loc}";`).join('\n')}`,
    ] as string[],
  };
  dict.files.forEach((file) => {
    const source = fs.readFileSync(path.resolve(CWD, file), 'utf-8');
    if (file.endsWith('.html')) {
      // handle html file
      handleHtml(source, file, output, meta, dict, indices);
    } else {
      // TODO: handle js file
      throw 'todo';
    }
  });
  fs.writeFileSync(path.join(TranslateDir, 'dict.js'), output.codes.join('\n'));
  fs.writeFileSync(path.join(TranslateDir, 'meta.json'), JSON.stringify(output.meta, null, 2));
}
