import path from 'path';
import { CWD } from '../util';
import { transformHtml } from './html';
import { transformJs } from './js';

export async function transform(source: string, resourcePath: string) {
  if (resourcePath.endsWith('.html')) {
    return await transformHtml(source, path.relative(CWD, resourcePath));
  } else {
    return await transformJs(source, path.relative(CWD, resourcePath));
  }
}
