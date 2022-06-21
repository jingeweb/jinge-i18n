import path from 'path';

export const CWD = process.cwd();
export const TranslateDir = path.join(CWD, 'translate');

export function needTranslate(cnt: string) {
  return /[\u4e00-\u9fa5]/.test(cnt);
}
