import path from 'path';
import { TemplateLiteral, Literal } from 'estree';
import { Parser, Comment, Node } from 'acorn';
import { needTranslate, CWD } from '../util';
import { SourceData } from './common';
import { walkAcorn } from './helper';

export function extractJsFile(content: string, sourceFile: string, data: SourceData) {
  const rf = path.relative(CWD, sourceFile);
  const comments: Comment[] = [];
  const tree = Parser.parse(content, {
    locations: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
    onComment: comments,
  });
  if (comments.some((cmt) => cmt.value.includes('@jinge-i18n-ignore'))) {
    console.log(`  ${rf}, ignored.`);
    return;
  }
  const pn = data.rows.length;
  const map = new Map();

  const pushRow = (text: string) => {
    if (!map.has(text)) {
      // 单文件内相同文案合并为一行，不支持单文件内相同文案有不同的翻译。
      data.rows.push([rf, text]);
      map.set(text, true);
    }
  };

  walkAcorn(tree, {
    TemplateLiteral: (node: TemplateLiteral & Node) => {
      pushRow(content.substring(node.start + 1, node.end - 1));
      return false;
    },
    Literal: (node: Literal & Node) => {
      const v = node.value;
      if (typeof v === 'string' && needTranslate(v)) {
        pushRow(v);
      }
      return false;
    },
  });
  console.log(`  ${rf}, ${data.rows.length - pn} rows`);
}
