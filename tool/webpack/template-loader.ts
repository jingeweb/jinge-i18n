import path from 'path';
import { LoaderContext } from 'webpack';
import { CWD, HtmlInlineTags, InlineTags } from '../util';
import { transform } from '../transform';

let InlineTags: InlineTags;

export default function JingeI18NLoader(this: LoaderContext<unknown>, source: string, map: string) {
  if (this.resourcePath.endsWith('.html') && !InlineTags) {
    InlineTags = {
      ...HtmlInlineTags,
      ...Object.fromEntries(
        ((this.query as { inlineTags?: string[] })?.inlineTags || []).map((item) => {
          const its = item.split(':');
          return [its[0], { type: 'component', library: its[1], component: its[2] }];
        }),
      ),
    };
  }
  const code = transform(source, {
    sourceFile: path.relative(CWD, this.resourcePath),
    inlineTags: InlineTags,
  });
  this.callback(null, code, map);
}
