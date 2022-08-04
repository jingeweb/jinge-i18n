import { InlineTags } from '../util';
import { SimpleHasher } from './hash';
import { parseOriginalTextExpr, parseTranslateTextExpr } from './parse';

export interface MetaCompnentInfo {
  name: string;
  params?: Record<string, number>;
}
export type MetaJSON = {
  dictionary: Record<
    string,
    {
      type: 'T' | 'R';
      hash: string;
      compoents?: Record<string, MetaCompnentInfo>;
      funcs?: Record<string, MetaCompnentInfo>;
    }
  >;
  attribute: Record<string, Record<string, MetaCompnentInfo>>;
};

export interface OriginalTextInfo {
  outputCodes: string[];
  index: number;
  text: string;
  hash: string;
  expr?: ReturnType<typeof parseOriginalTextExpr>;
  /** 如果有 renderFn 说明是包含了 inline tag 的合并文本，需要使用渲染函数而不是简单地字符串 */
  renderFn?: {
    jingeImports: Set<string>;
    aliasImportsCodes: Set<string>;
  };
  translateIndexMap: {
    [locale: string]: Map<string, TranslateTextInfo>;
  };
  exportSymbolMap: Map<string, boolean>;
}
export interface TranslateTextInfo {
  index: number;
  text: string;
  expr?: ReturnType<typeof parseTranslateTextExpr>;
}
export interface MetaStore {
  inlineTags: InlineTags;
  defaultLocale: string;
  hasher: SimpleHasher;
  textRegisterMap: Map<string, OriginalTextInfo>;
  attrRegisterMap: Map<
    string,
    {
      attrVList: {
        hash: string;
        text: string;
        importSymbols: Set<string>;
      }[];
      exportSymbolSet: Set<string>;
      componentCodes: string[];
    }
  >;
  outputJson: MetaJSON;
}
