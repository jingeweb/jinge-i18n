import path from 'path';
import { parse as parseHtml, INode, SyntaxKind } from '@jingeweb/html5parser';
import { needTranslate, InlineTags, CWD } from '../util';
import { SourceData } from './common';
import { isI18nConcatNode } from './helper';

export function extractHtmlFile(content: string, sourceFile: string, data: SourceData, inlineTags: InlineTags) {
  const rf = path.relative(CWD, sourceFile);
  const inodes = parseHtml(content);
  const pn = data.rows.length;
  const map = new Map();

  const pushRow = (text: string) => {
    if (!map.has(text)) {
      // 单文件内相同文案合并为一行，不支持单文件内相同文案有不同的翻译。
      data.rows.push([rf, text]);
      map.set(text, true);
    }
  };

  function handleConcatNodes(nodes: INode[]) {
    let text;
    if (nodes.length === 1 && nodes[0].type === SyntaxKind.Tag) {
      const n = nodes[0];
      text = content.substring(n.open.end, n.close.start).trim();
    } else {
      text = nodes
        .map((node) => {
          return content.substring(node.start, node.end).trim();
        })
        .join('');
    }

    if (!text || !needTranslate(text)) return;
    pushRow(text);
  }

  function walkNodes(nodes: INode[]) {
    /** 连续的 pure node */
    const pns: INode[] = [];

    nodes.forEach((node, idx) => {
      if (node.type === SyntaxKind.Tag && node.name === '!--') {
        if (idx === nodes.length - 1 && pns.length > 0) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
        return; // skip comment
      }
      if (node.type === SyntaxKind.Text) {
        if (!/[^\s]/.test(node.value)) {
          if (idx === nodes.length - 1 && pns.length > 0) {
            handleConcatNodes(pns);
            pns.length = 0;
          }
          return; // skip whole whitespace
        }
        pns.push(node);
        if (idx === nodes.length - 1) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
        return;
      }

      if (isI18nConcatNode(node, inlineTags)) {
        pns.push(node);
        if (idx === nodes.length - 1) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
        return; // pure node 不需要进行后续的处理。
      } else {
        if (pns.length > 0) {
          handleConcatNodes(pns);
          pns.length = 0;
        }
      }

      if (node.rawName === 'switch-locale' || node.rawName === 'SwitchLocaleComponent') {
        // 忽略 <switch-locale></switch-locale> 内部包裹的内容
        return;
      }

      node.attributes.forEach((iattr) => {
        const v = iattr.value?.value.trim();
        if (!v || !needTranslate(v)) return;
        if (iattr.name.value.includes(':')) {
          // 当前不支持 :a="name + '你好'" 这种表达式属性的多语言抽取，可改为 a="${name}你好"。
          console.error(
            `[warning] expression attribute won\'t be extract, please use string attribute instead.\n  --> ${path.relative(
              CWD,
              sourceFile,
            )}, Ln ${iattr.value.loc.start.line}, Col ${iattr.value.loc.start.column}`,
          );
          return;
        }
        pushRow(v);
      });
      if (node.body?.length) {
        walkNodes(node.body);
      }
    });
  }
  walkNodes(inodes);

  console.log(`  ${rf}, ${data.rows.length - pn} rows`);
}
