import { Node, parse as _parseexpr } from 'acorn';
import { Expression, TemplateLiteral } from 'estree';
import { needTranslate } from '../util';
import { logErr, Position } from './helper';

export function parseOriginalTextExpr(text: string, globalParams?: Map<string, number>) {
  const expr = '`' + text + '`';
  const tree = _parseexpr(expr, {
    locations: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
  }) as unknown as { body: [{ expression: TemplateLiteral & Node }] };
  const node = tree.body?.[0]?.expression;
  if (!node) throw new Error('unexpected.');
  if (node.expressions.length === 0) {
    return null;
  }
  const params: Record<string, number> = {};
  let i = 0;
  const pis = node.expressions.map((en: Expression & Node) => {
    const code = expr.substring(en.start, en.end).trim();
    if (code in params) return params[code];
    if (globalParams) {
      if (!globalParams.has(code)) {
        globalParams.set(code, globalParams.size);
      }
      params[code] = globalParams.get(code);
    } else {
      params[code] = i;
      i++;
    }
    return params[code];
  });
  return {
    params,
    code: node.quasis
      .map((el, i) => {
        return el.value.raw + (el.tail ? '' : `\${attrs.p${pis[i]}}`);
      })
      .join(''),
  };
}

export function parseTranslateTextExpr(
  text: string,
  originalParams: Record<string, number>,
  sourceFile: string,
  loc: Position,
) {
  const expr = '`' + text + '`';
  const tree = _parseexpr(expr, {
    locations: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
  }) as unknown as { body: [{ expression: TemplateLiteral & Node }] };
  const node = tree.body?.[0]?.expression;
  if (!node) throw new Error('unexpected.');
  if (node.expressions.length === 0) {
    return null;
  }

  const pis = node.expressions.map((en: Expression & Node) => {
    const code = expr.substring(en.start, en.end).trim();
    if (needTranslate(code)) {
      logErr(
        '[warning] expression need translate is not support.\n  --> ' + JSON.stringify(code),
        sourceFile,
        loc,
        'warning',
      );
    } else if (!(code in originalParams)) {
      logErr(
        `parameters of expression does not match with original text.\n  --> ${JSON.stringify(text)}`,
        sourceFile,
        loc,
        'warning',
      );
      return -1;
    }
    return originalParams[code];
  });
  return {
    // params,
    code: node.quasis
      .map((el, i) => {
        const pi = pis[i];
        return el.value.raw + (el.tail || pi < 0 ? '' : `\${attrs.p${pi}}`);
      })
      .join(''),
  };
}
