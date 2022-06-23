import path from 'path';
import { parse as parseHtml, INode, SyntaxKind } from '@jingeweb/html5parser';
import { needTranslate, CWD } from '../util';
import { SourceData } from './common';

export function extractHtmlFile(content: string, sourceFile: string, data: SourceData) {
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
              sourceFile,
            )}, Ln ${iattr.value.loc.start.line}, Col ${iattr.value.loc.start.column}`,
          );
          return;
        }
        pushRow(v);
      });
      if (node.rawName === 'switch-locale' || node.rawName === 'SwitchLocaleComponent') {
        // 忽略 <switch-locale></switch-locale> 内部包裹的内容
        return;
      } else {
        node.body?.forEach((cn) => walkNode(cn));
      }
    }
  };
  inodes.forEach((node) => walkNode(node));
  console.log(`  ${rf}, ${data.rows.length - pn} rows`);
}
