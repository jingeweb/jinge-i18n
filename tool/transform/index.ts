import { InlineTags } from '../util';
import { transformHtml } from './html';
import { transformJs } from './js';

export function transform(
  source: string,
  options: {
    sourceFile: string;
    inlineTags: InlineTags;
  },
) {
  if (options.sourceFile.endsWith('.html')) {
    return transformHtml(source, options.sourceFile, options.inlineTags);
  } else {
    return transformJs(source, options.sourceFile);
  }
}
