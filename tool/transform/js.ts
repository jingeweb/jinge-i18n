import path from 'path';
import { parse, Node, Comment } from 'acorn';
import { Literal, TemplateLiteral } from 'estree';
import { util } from 'jinge-compiler';
import { needTranslate, TranslateDictDir } from '../util';
import { MetaJSON } from '../generate/common';
import { walkAcorn } from '../extract/helper';
import { getMeta } from './meta';

const { getReplaceResult, sortedInsert } = util;

interface TransformStore {
  replaces: util.ReplaceItem[];
  importComponents: Map<string, Set<string>>;
}

function logErr(
  msg: string,
  file: string,
  loc: { line: number; column: number },
  type: 'error' | 'warning' = 'warning',
) {
  console.error(`[${type}] ${msg}\n --> ${file}, Ln ${loc.line}, Col ${loc.column}`);
}

function handleText(text: string, sourceFile: string, store: TransformStore, meta: MetaJSON, node: Node) {
  if (!text || !needTranslate(text)) return;
  // console.log(text);
  const info = meta.dictionary[text];
  const comp = info?.funcs?.[sourceFile];
  if (!comp) {
    logErr(
      `text not found in dictionary, you may need re-run jinge-i18n extract\n --> ${JSON.stringify(text)}`,
      sourceFile,
      node.loc.start,
    );
    return;
  }
  const importfile = `${info.hash}.js`;
  let imps = store.importComponents.get(importfile);
  if (!imps) store.importComponents.set(importfile, (imps = new Set()));
  imps.add(comp.name);
  const params = comp.params
    ? '{ ' +
      Object.keys(comp.params)
        .map((code) => `p${comp.params[code]}: ${code}`)
        .join(', ') +
      ' }'
    : '';
  sortedInsert(store.replaces, {
    sn: node.start,
    se: node.end,
    code: `${comp.name}(${params})`,
  });
}
export function transformJs(source: string, sourceFile: string) {
  const meta = getMeta();
  const comments: Comment[] = [];
  const tree = parse(source, {
    locations: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
    onComment: comments,
  });
  if (comments.some((cmt) => cmt.value.includes('@jinge-i18n-ignore'))) {
    return source;
  }

  const store: TransformStore = {
    importComponents: new Map(),
    replaces: [],
  };
  walkAcorn(tree, {
    TemplateLiteral: (node: TemplateLiteral & Node) => {
      handleText(source.substring(node.start + 1, node.end - 1), sourceFile, store, meta, node);
      return false;
    },
    Literal: (node: Literal & Node) => {
      const v = node.value;
      if (typeof v === 'string') {
        handleText(v, sourceFile, store, meta, node);
      }
      return false;
    },
  });

  if (!store.replaces.length) return source;

  let impCode = '';
  store.importComponents.forEach((imps, importFile) => {
    impCode += `import { ${Array.from(imps).join(', ')} } from '${path.join(TranslateDictDir, importFile)}';`;
  });
  sortedInsert(store.replaces, { sn: 0, se: 0, code: `${impCode}` });

  const code = getReplaceResult(store.replaces, source);
  // console.log(code);
  return code;
}
