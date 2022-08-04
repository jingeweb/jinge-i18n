import path from 'path';
import { INode, ITag, IAttribute, parse, SyntaxKind } from '@jingeweb/html5parser';
import { util } from 'jinge-compiler';
import { InlineTags, needTranslate, TranslateDictDir } from '../util';
import { MetaJSON } from '../generate/common';
import { isI18nConcatNode } from '../extract/helper';
import { getMeta } from './meta';

const { getReplaceResult, sortedInsert } = util;

function logErr(
  msg: string,
  file: string,
  loc: { line: number; column: number },
  type: 'error' | 'warning' = 'warning',
) {
  console.error(`[${type}] ${msg}\n --> ${file}, Ln ${loc.line}, Col ${loc.column}`);
}

interface TransformStore {
  importComponents: Map<string, Set<string>>;
  attrVMInc: number;
}
async function handleAttrs(
  node: ITag,
  meta: MetaJSON,
  sourceFile: string,
  store: TransformStore,
  replaces: util.ReplaceItem[],
) {
  const attrHashes: { hash: string; node: IAttribute }[] = [];
  node.attributes.forEach((iattr) => {
    const originalText = iattr.value?.value.trim();
    if (!originalText || !needTranslate(originalText)) return;
    const info = meta.dictionary[originalText];
    if (!info) {
      logErr(
        `attribute value not found, you may need re-run jinge-i18n extract\n --> ${JSON.stringify(originalText)}`,
        sourceFile,
        iattr.value.loc.start,
      );
      return;
    }
    attrHashes.push({ hash: info.hash, node: iattr });
  });
  if (attrHashes.length === 0) {
    return;
  }
  attrHashes.sort((ha, hb) => {
    return ha.hash === hb.hash ? 0 : ha.hash > hb.hash ? 1 : -1;
  });

  const hash = attrHashes.map((h) => h.hash).join('_');
  const vmCtx = `ctx_${hash}_${store.attrVMInc++}`;
  attrHashes.forEach((h, i) => {
    sortedInsert(replaces, {
      sn: h.node.name.start,
      se: h.node.name.start,
      code: ':',
    });
    sortedInsert(replaces, {
      sn: h.node.value.start + 1, // +1 to include quota char: "
      se: h.node.value.end - 1,
      code: `${vmCtx}[${i}]`,
    });
  });
  const comp = meta.attribute[sourceFile]?.[hash];
  if (!comp) {
    logErr(
      `attribute combination not found in dictionary, you may need re-run jinge-i18n generate`,
      sourceFile,
      node.loc.start,
    );
    return;
  }
  const importfile = `${hash}.js`;
  let imps = store.importComponents.get(importfile);
  if (!imps) store.importComponents.set(importfile, (imps = new Set()));
  imps.add(comp.name);
  const params = comp.params
    ? Object.keys(comp.params)
        .map((code) => ` :p${comp.params[code]}="${code}"`)
        .join('')
    : '';
  sortedInsert(replaces, {
    sn: node.start,
    se: node.start,
    code: `<${comp.name}${params} vm:c="${vmCtx}">`,
  });
  sortedInsert(replaces, {
    sn: node.end,
    se: node.end,
    code: `</${comp.name}>`,
  });
}
export function transformHtml(source: string, sourceFile: string, inlineTags: InlineTags) {
  const meta = getMeta();
  const inodes = parse(source);
  const replaces: util.ReplaceItem[] = [];
  const store: TransformStore = {
    importComponents: new Map(),
    attrVMInc: 0,
  };

  function handleConcatNodes(nodes: INode[]) {
    let text;
    if (nodes.length === 1 && nodes[0].type === SyntaxKind.Tag) {
      const n = nodes[0];
      text = source.substring(n.open.end, n.close.start).trim();
    } else {
      text = nodes
        .map((node) => {
          return source.substring(node.start, node.end).trim();
        })
        .join('');
    }

    if (!text || !needTranslate(text)) {
      return;
    }

    const info = meta.dictionary[text];
    const comp = info?.compoents?.[sourceFile];
    if (!comp) {
      logErr(
        `text not found in dictionary, you may need re-run jinge-i18n extract\n --> ${JSON.stringify(text)}`,
        sourceFile,
        nodes[0].loc.start,
      );
      return;
    }
    const importfile = `${info.hash}.js`;
    let imps = store.importComponents.get(importfile);
    if (!imps) store.importComponents.set(importfile, (imps = new Set()));
    imps.add(comp.name);
    const params = comp.params
      ? Object.keys(comp.params)
          .map((code) => ` :p${comp.params[code]}="${code}"`)
          .join('')
      : '';
    sortedInsert(replaces, {
      sn: nodes[0].start,
      se: nodes[nodes.length - 1].end,
      code: `<${comp.name}${params} />`,
    });
  }

  function walkNodes(nodes: INode[]) {
    /** 连续的 pure node */
    const pns: INode[] = [];

    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes[idx];
      if (node.type === SyntaxKind.Tag && node.name === '!--') {
        if (idx === nodes.length - 1 && pns.length > 0) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
        continue; // skip comment
      }
      if (node.type === SyntaxKind.Text) {
        if (!/[^\s]/.test(node.value)) {
          if (idx === nodes.length - 1 && pns.length > 0) {
            handleConcatNodes(pns);
            pns.length = 0;
          }
          continue; // skip whole whitespace
        }
        pns.push(node);
        if (idx === nodes.length - 1) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
        continue;
      }
      if (isI18nConcatNode(node, inlineTags)) {
        pns.push(node);
        if (idx === nodes.length - 1) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
        continue; // pure node 不需要进行后续的处理。
      } else {
        if (pns.length > 0) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
      }

      if (node.rawName === 'switch-locale' || node.rawName === 'SwitchLocaleComponent') {
        // 忽略 <switch-locale></switch-locale> 内部包裹的内容
        continue;
      }

      if (node.attributes.length) {
        handleAttrs(node, meta, sourceFile, store, replaces);
      }
      if (node.body?.length) {
        walkNodes(node.body);
      }
    }
  }

  walkNodes(inodes);

  if (!replaces.length) return source;

  let impCode = '';
  store.importComponents.forEach((imps, importFile) => {
    impCode += `import { ${Array.from(imps).join(', ')} } from '${path.join(TranslateDictDir, importFile)}';`;
  });

  sortedInsert(replaces, { sn: 0, se: 0, code: `<!-- ${impCode} -->\n` });

  const code = getReplaceResult(replaces, source);

  return code;
}
