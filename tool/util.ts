import path from 'path';

export const CWD = process.cwd();
export const TranslateDir = path.join(CWD, 'translate');
export const TranslateDictDir = path.join(TranslateDir, 'dict');
export const TranslateMetaDir = path.join(TranslateDir, 'meta');
export const I18N_POSTFIX = '_xg0402';

export function needTranslate(cnt: string) {
  return /[\u4e00-\u9fa5]/.test(cnt);
}
