import { parse } from '@jingeweb/html5parser';
import { util } from 'jinge-compiler';
import { walkNode } from './extract';

export async function transform(source: string) {
  const inodes = parse(source);
  const replaces: util.ReplaceItem[] = [];
  const handle: Parameters<typeof walkNode>[2] = (context, type, node) => {
    
  };
  inodes.forEach((node) => walkNode(node, source, handle));
}
