import { transformSync } from 'esbuild';
import { MetaStore } from './common';
import { DictStore } from './dict';
import { handleJs } from './js';

export function handleTs(source: string, sourceFile: string, dict: DictStore, meta: MetaStore) {
  const { code } = transformSync(source, {
    target: 'es2020',
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  handleJs(code, sourceFile, dict, meta);
}
