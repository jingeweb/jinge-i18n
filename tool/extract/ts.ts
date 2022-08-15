import { transformSync } from 'esbuild';
import { SourceData } from './common';
import { extractJsFile } from './js';

export function extractTsFile(content: string, sourceFile: string, data: SourceData) {
  const { code } = transformSync(content, {
    target: 'es2020',
    format: 'esm',
    loader: 'ts',
    charset: 'utf8',
    sourcemap: false,
  });
  extractJsFile(code, sourceFile, data);
}
