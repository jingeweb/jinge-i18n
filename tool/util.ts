import path from 'path';

export const CWD = process.cwd();
export const TranslateDir = path.join(CWD, 'translate');
export const TranslateDictDir = path.join(TranslateDir, 'dict');
export const TranslateMetaDir = path.join(TranslateDir, 'meta');
export const I18N_POSTFIX = '_xg0402';

export interface InlineTags {
  [k: string]:
    | {
        type: 'html';
      }
    | {
        type: 'component';
        library: string;
        component: string;
      };
}

/** 需要进行 i18n 整合的 html tags */
export const HtmlInlineTags: InlineTags = Object.fromEntries(
  ['code', 'small', 'strong', 'bold', 'a', 'i', 'span'].map((tag) => [tag, { type: 'html' }]),
);

export function needTranslate(cnt: string) {
  return /[\u4e00-\u9fa5]/.test(cnt);
}
