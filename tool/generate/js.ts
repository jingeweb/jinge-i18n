import { TemplateLiteral, Literal } from 'estree';
import { Parser, Comment, Node } from 'acorn';
import { needTranslate } from '../util';
import { walkAcorn } from '../extract/helper';
import { DictStore } from './dict';
import { Position, registerText } from './helper';
import { MetaCompnentInfo, MetaStore } from './common';

function handleText(originalText: string, sourceFile: string, meta: MetaStore, dict: DictStore, loc: Position) {
  if (!originalText || !needTranslate(originalText)) return;
  const { originalTextInfo, dictionaryFnId } = registerText(originalText, sourceFile, meta, dict, loc) || {};
  if (!originalTextInfo) return;
  const componentName = `F${originalTextInfo.info.hash}_${dictionaryFnId}`;
  if (!originalTextInfo.info.exportSymbolMap.has(componentName)) {
    originalTextInfo.info.exportSymbolMap.set(componentName, true);
    originalTextInfo.info.outputCodes.push(`export const ${componentName} = (attrs) => t(${dictionaryFnId}, attrs);\n`);
  }

  const record = meta.outputJson.dictionary[originalText];
  if (!record) throw 'unimpossible??';
  if (!record.funcs) record.funcs = {};
  const info = record.funcs[sourceFile];
  if (info) {
    if (info.name !== componentName) {
      throw 'unexpected??';
    }
    return;
  }
  const c: MetaCompnentInfo = { name: componentName };
  const p = originalTextInfo.info.expr?.params;
  if (p) c.params = p;
  record.funcs[sourceFile] = c;
}

export function handleJs(source: string, sourceFile: string, dict: DictStore, meta: MetaStore) {
  const comments: Comment[] = [];
  const tree = Parser.parse(source, {
    locations: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
    onComment: comments,
  });
  if (comments.some((cmt) => cmt.value.includes('@jinge-i18n-ignore'))) {
    console.log('ignore file:', sourceFile);
    return;
  }

  walkAcorn(tree, {
    TemplateLiteral: (node: TemplateLiteral & Node) => {
      handleText(source.substring(node.start + 1, node.end - 1), sourceFile, meta, dict, node.loc.start);
      return false;
    },
    Literal: (node: Literal & Node) => {
      if (typeof node.value !== 'string') return false;
      handleText(node.value, sourceFile, meta, dict, node.loc.start);
      return false;
    },
  });
}
