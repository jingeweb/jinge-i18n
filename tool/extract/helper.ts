import fs from 'fs';
import path from 'path';
import { Node } from 'acorn';
import { base as BaseAcornVisitor } from 'acorn-walk';
import { SyntaxKind, ITag } from '@jingeweb/html5parser';
import { needTranslate, InlineTags } from '../util';

export function glob(dir: string) {
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

export function walkAcorn(node: { type: string }, visitors: Record<string, (...args: unknown[]) => void | boolean>) {
  (function c(node, state?: unknown, override?: string) {
    const found = visitors[node.type] || (override ? visitors[override] : null);
    let stopVisit = false;
    if (found) {
      if (found(node, state) === false) stopVisit = true;
    }
    if (!stopVisit) {
      BaseAcornVisitor[override || node.type](node as Node, state, c);
    }
  })(node);
}

export function hasNoneTextChild(node: ITag) {
  if (!node.body.length) return false;
  return node.body.some((cn) => cn.type !== SyntaxKind.Text);
}

/**
 * 是否是 pure node，即是否可以做为连续的 i18n 整体。
 * 文本节点（IText）和满足下述条件的 html 标签是 pure node。
 * 1. 没有子节点或所有子节点都是文本节点。且
 * 2. 没有除字符串常量之外的属性，且字符串没有包含中文。
 */
export function isI18nConcatNode(node: ITag, inlineTags: InlineTags) {
  if (!(node.rawName in inlineTags)) return false;
  if (node.body?.length && node.body.some((cn) => cn.type !== SyntaxKind.Text)) {
    return false;
  }
  if (
    node.attributes?.length &&
    node.attributes.some((attr) => {
      if (attr.name.value.indexOf(':') >= 0) return true;
      const v = attr.value?.value;
      if (v && /(^|[^\\])\$\{/.test(attr.value.value)) return true;
      if (v && needTranslate(v)) return true;
      return false;
    })
  ) {
    return false;
  }
  return true;
}
