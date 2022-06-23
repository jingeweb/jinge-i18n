import fs from 'fs';
import path from 'path';
import { Node } from 'acorn';
import { base as BaseAcornVisitor } from 'acorn-walk';

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
