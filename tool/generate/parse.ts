import { Node, parse as _parseexpr } from 'acorn';
import { Expression, TemplateLiteral } from 'estree';

export function parseExpr(text: string, piOffset = 0) {
  const expr = '`' + text + '`';
  const tree = _parseexpr(expr, {
    locations: true,
    ecmaVersion: 'latest',
    sourceType: 'module',
  }) as unknown as { body: [{ expression: TemplateLiteral & Node }] };
  const node = tree.body?.[0]?.expression;
  if (!node) throw new Error('unexpected.');
  if (node.expressions.length === 0) {
    return { text };
  }
  return {
    params: node.expressions.map((en: Expression & Node) => expr.substring(en.start, en.end).trim()),
    text: node.quasis
      .map((el, i) => {
        return el.value.raw + (el.tail ? '' : `\${attrs.p${i + piOffset}}`);
      })
      .join(''),
  };
}
