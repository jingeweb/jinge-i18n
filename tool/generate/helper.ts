import { TemplateParser } from 'jinge-compiler';
import { MetaStore, OriginalTextInfo, TranslateTextInfo } from './common';
import { DictStore } from './dict';
import { SimpleHasher } from './hash';
import { parseOriginalTextExpr, parseTranslateTextExpr } from './parse';

export interface Position {
  line: number;
  column: number;
}

export function logErr(msg: string, sourceFile: string, loc: Position, type: 'warning' | 'error' = 'warning') {
  console.error(`[${type}] ${msg}\n  --> ${sourceFile}, Ln ${loc.line}, Col ${loc.column}`);
}

export function getOriginalTextInfo(
  indexMap: MetaStore['textRegisterMap'],
  text: string,
  hasher: SimpleHasher,
  globalParams?: Map<string, number>,
) {
  if (indexMap.has(text)) {
    return {
      isNew: false,
      info: indexMap.get(text),
    };
  }
  const rtn: OriginalTextInfo = {
    index: indexMap.size,
    text: text,
    hash: hasher.getHash(text),
    expr: parseOriginalTextExpr(text, globalParams),
    outputCodes: [],
    translateIndexMap: {},
    exportSymbolMap: new Map(),
  };
  indexMap.set(text, rtn);
  return {
    isNew: true,
    info: rtn,
  };
}

export function getTranslateTextInfo(
  indexMap: Map<string, TranslateTextInfo>,
  text: string,
  originalParams: Record<string, number>,
  sourceFile: string,
  loc: Position,
) {
  if (indexMap.has(text)) {
    return {
      isNew: false,
      info: indexMap.get(text),
    };
  }
  const info: TranslateTextInfo = {
    index: indexMap.size,
    text,
    expr: originalParams ? parseTranslateTextExpr(text, originalParams, sourceFile, loc) : null,
  };
  indexMap.set(text, info);
  return {
    isNew: true,
    info,
  };
}

function expr2code(expr: { code: string } | undefined, originalText: string) {
  return `(${expr ? 'attrs' : ''}) => ${expr ? `\`${expr.code}\`` : JSON.stringify(originalText)}`;
}

export function registerText(
  type: 'text' | 'attr' | 'literal',
  originalText: string,
  sourceFile: string,
  meta: MetaStore,
  dict: DictStore,
  loc: Position,
  attrsParams?: Map<string, number>,
) {
  const tmap = dict.tree.get(originalText)?.get(sourceFile);
  if (!tmap) {
    logErr(
      `text not found in ${meta.defaultLocale}.csv, you may need re-run jinge-i18n extract\n  --> ${originalText}`,
      sourceFile,
      loc,
    );
    return null;
  }
  const targetLocales = dict.locales;
  targetLocales.forEach((locale) => {
    if (!tmap.get(locale)) {
      logErr(`${locale} translate missing\n  --> ${JSON.stringify(originalText)}`, sourceFile, loc);
      tmap.set(locale, '--miss--');
    }
  });
  const originalTextInfo = getOriginalTextInfo(meta.textRegisterMap, originalText, meta.hasher, attrsParams);
  const defaultLocaleId = meta.defaultLocale.replace('_', '').toUpperCase();
  if (originalTextInfo.isNew) {
    const expr = originalTextInfo.info.expr;
    let code: string;
    if (type === 'text' && originalText.indexOf('<') >= 0) {
      const { jingeImports, aliasImportsCodes } = (originalTextInfo.info.renderFn = {
        jingeImports: new Set(),
        aliasImportsCodes: new Set(),
      });
      const result = TemplateParser.parse2(expr?.code || originalText, {
        resourcePath: originalText,
        addDebugName: false,
        emitErrorFn: (err) => console.error(err),
      });
      result.jingeImports.forEach((imp) => {
        if (!jingeImports.has(imp)) {
          originalTextInfo.info.outputCodes.unshift(`import { ${imp} } from 'jinge';`);
          jingeImports.add(imp);
        }
      });
      if (result.aliasImportsCode && !aliasImportsCodes.has(result.aliasImportsCode)) {
        originalTextInfo.info.outputCodes.unshift(result.aliasImportsCode);
        aliasImportsCodes.add(result.aliasImportsCode);
      }
      code = result.renderFnCode;
    } else {
      code = expr2code(expr, originalText);
    }
    originalTextInfo.info.outputCodes.push(`export const ${defaultLocaleId} = ${code};`);
  }
  const record = meta.outputJson.dictionary[originalText];
  if (!record) {
    meta.outputJson.dictionary[originalText] = {
      type: originalTextInfo.info.renderFn ? 'R' : 'T',
      hash: originalTextInfo.info.hash,
    };
  }

  const targetLocalesIds: string[] = [];
  for (const locale of targetLocales) {
    const translateText = tmap.get(locale);
    let idxMap = originalTextInfo.info.translateIndexMap[locale];
    if (!idxMap) idxMap = originalTextInfo.info.translateIndexMap[locale] = new Map();
    const translateTextInfo = getTranslateTextInfo(
      idxMap,
      translateText,
      originalTextInfo.info.expr?.params,
      sourceFile,
      loc,
    );
    const id = locale.replace('_', '').toUpperCase() + (translateTextInfo.info.index || '').toString();
    if (translateTextInfo.isNew) {
      const expr = translateTextInfo.info.expr;
      let code: string;
      if (originalTextInfo.info.renderFn) {
        const result = TemplateParser.parse2(expr?.code || translateText, {
          resourcePath: translateText,
          addDebugName: false,
          emitErrorFn: (err) => console.error(err),
        });
        const { jingeImports, aliasImportsCodes } = originalTextInfo.info.renderFn;
        result.jingeImports.forEach((imp) => {
          if (!jingeImports.has(imp)) {
            originalTextInfo.info.outputCodes.unshift(`import { ${imp} } from 'jinge';`);
            jingeImports.add(imp);
          }
        });
        if (result.aliasImportsCode && !aliasImportsCodes.has(result.aliasImportsCode)) {
          originalTextInfo.info.outputCodes.unshift(result.aliasImportsCode);
          aliasImportsCodes.add(result.aliasImportsCode);
        }
        code = result.renderFnCode;
      } else {
        code = expr2code(expr, translateText);
      }
      originalTextInfo.info.outputCodes.push(`export const ${id} = ${code};`);
    }
    targetLocalesIds.push(id);
  }

  const dictionaryFnId = defaultLocaleId + '_' + targetLocalesIds.join('_');
  if (!originalTextInfo.info.exportSymbolMap.has(dictionaryFnId)) {
    originalTextInfo.info.exportSymbolMap.set(dictionaryFnId, true);
    const targetLocalesCode = dict.locales
      .map((loc, li) => {
        const varName = targetLocalesIds[li] as string;
        return li === dict.locales.length - 1 ? varName : `locale === '${loc}' ? ${varName} : `;
      })
      .join('');
    originalTextInfo.info.outputCodes.push(
      `export const ${dictionaryFnId} = (locale) => locale === '${meta.defaultLocale}' ? ${defaultLocaleId} : ${targetLocalesCode};`,
    );
  }
  return {
    originalTextInfo,
    // targetLocalesIds,
    dictionaryFnId,
  };
}
