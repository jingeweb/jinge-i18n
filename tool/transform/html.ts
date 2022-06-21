import path from 'path';
import { INode, ITag, parse, SyntaxKind } from '@jingeweb/html5parser';
import { util } from 'jinge-compiler';
import { needTranslate, TranslateDir } from '../util';
import { getMeta } from './meta';

const { getReplaceResult, sortedInsert, IMPORT_POSTFIX } = util;

const I18N_POSTFIX = '_i18n' + IMPORT_POSTFIX;

function logErr(
  msg: string,
  file: string,
  loc: { line: number; column: number },
  type: 'error' | 'warning' = 'warning',
) {
  console.error(`[${type}] ${msg}\n --> ${file}, Ln ${loc.line}, Col ${loc.column}`);
}

const DICT_FILE = path.join(TranslateDir, 'dict.js');

export async function transformHtml(source: string, file: string) {
  const meta = getMeta();
  const inodes = parse(source);
  const replaces: util.ReplaceItem[] = [];
  let commentNode: ITag;
  const importComponents: Set<string> = new Set();
  const walkNode = (node: INode) => {
    if (node.type === SyntaxKind.Text) {
      const text = node.value.trim();
      if (needTranslate(text)) {
        // dicts.zh_cn.
        const info = meta[text]?.[file];
        if (!info) {
          logErr(
            `text not found in dictionary, you may need re-run jinge-i18n extract\n --> ${JSON.stringify(text)}`,
            file,
            node.loc.start,
          );
          return;
        }
        importComponents.add(info.component);
        sortedInsert(replaces, {
          sn: node.start,
          se: node.end,
          code: `<${info.component}${I18N_POSTFIX}${
            info.params ? info.params.map((p) => ` p${p.pi}="${p.expr}"`).join('') : ''
          } />`,
        });
      }
    } else if (node.name !== '!--') {
      node.attributes.forEach((iattr) => {
        const v = iattr.value?.value.trim();
        if (!v || !needTranslate(v)) return;
        // pushRow(v);
        throw 'todo';
      });
      if (node.rawName === '_t') {
        let text = source.substring(node.open.end, node.close.start).trim();
        if (!needTranslate(text)) {
          return;
        }
        if (text.indexOf('\n') >= 0) text = text.replace(/\n/g, '');
        // pushRow(text);
        throw 'todo';
      } else {
        node.body?.forEach((cn) => walkNode(cn));
      }
    } else {
      if (!commentNode) commentNode = node;
    }
  };
  inodes.forEach((node) => walkNode(node));

  if (!replaces.length) return source;

  const imp = `import { ${Array.from(importComponents)
    .map((c) => `${c} as ${c}${I18N_POSTFIX}`)
    .join(', ')} } from '${DICT_FILE}';`;

  if (!commentNode) {
    sortedInsert(replaces, { sn: 0, se: 0, code: `<!-- ${imp} -->` });
  } else {
    sortedInsert(replaces, { sn: commentNode.open.end, se: commentNode.open.end, code: imp });
  }

  const code = getReplaceResult(replaces, source);
  // console.log(code);
  return code;
}
