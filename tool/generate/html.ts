import { parse as parseHtml, INode, ITag, SyntaxKind } from '@jingeweb/html5parser';
import { needTranslate } from '../util';
import { DictStore } from './dict';
import { Position, registerText } from './helper';
import { MetaCompnentInfo, MetaStore } from './common';

function handleText(originalText: string, sourceFile: string, meta: MetaStore, dict: DictStore, loc: Position) {
  const { originalTextInfo, dictionaryFnId } = registerText(originalText, sourceFile, meta, dict, loc) || {};
  if (!originalTextInfo) return;
  const componentName = `T${originalTextInfo.info.hash}_${dictionaryFnId}`;
  if (!originalTextInfo.info.exportSymbolMap.has(componentName)) {
    originalTextInfo.info.exportSymbolMap.set(componentName, true);
    originalTextInfo.info.outputCodes.push(
      `export class ${componentName} extends TComponent {\n  static d = ${dictionaryFnId};\n}`,
    );
  }

  const record = meta.outputJson.dictionary[originalText];
  if (!record) throw 'unimpossible??';
  if (!record.compoents) record.compoents = {};
  const info = record.compoents[sourceFile];
  if (info) {
    if (info.name !== componentName) {
      throw 'unexpected??';
    }
    return;
  }
  const c: MetaCompnentInfo = { name: componentName };
  const p = originalTextInfo.info.expr?.params;
  if (p) c.params = p;
  record.compoents[sourceFile] = c;
}

function handleAttrs(node: ITag, sourceFile: string, meta: MetaStore, dict: DictStore) {
  const infos: ReturnType<typeof registerText>[] = [];
  const attrsParams: Map<string, number> = new Map();
  node.attributes.forEach((iattr) => {
    const originalText = iattr.value?.value.trim();
    if (!originalText || !needTranslate(originalText)) return;
    if (iattr.name.value.includes(':')) {
      // 当前不支持 :a="name + '你好'" 这种表达式属性的多语言抽取，可改为 a="${name}你好"。
      console.error(
        `[warning] expression attribute won\'t be extract, please use string attribute instead.\n  --> ${sourceFile}, Ln ${iattr.value.loc.start.line}, Col ${iattr.value.loc.start.column}`,
      );
      return;
    }
    const info = registerText(originalText, sourceFile, meta, dict, iattr.value.loc.start, attrsParams);
    if (!info) return;
    infos.push(info);
  });
  if (!infos.length) {
    return;
  }

  // 对属性的文本进行排序。这样诸如 <A a="一" b="二" /> 和 <B c="二" d="一" /> 可以用同一个 AComponent 包裹。
  infos.sort((a, b) => {
    const ta = a.originalTextInfo.info.hash as string;
    const tb = b.originalTextInfo.info.hash as string;
    return ta === tb ? 0 : ta > tb ? 1 : -1;
  });
  const attrHashes = infos.map((info) => info.originalTextInfo.info.hash).join('_');
  let attrReg = meta.attrRegisterMap.get(attrHashes);
  if (!attrReg) {
    meta.attrRegisterMap.set(
      attrHashes,
      (attrReg = {
        attrVList: infos.map((info) => ({
          hash: info.originalTextInfo.info.hash,
          text: info.originalTextInfo.info.text,
          importSymbols: new Set(),
        })),
        componentCodes: [],
        exportSymbolSet: new Set(),
      }),
    );
  }

  const componentName = `A${attrHashes}_${infos.map((info) => info.dictionaryFnId).join('_')}`;
  if (attrReg.exportSymbolSet.has(componentName)) {
    return;
  }
  attrReg.exportSymbolSet.add(componentName);

  const dCode: string[] = [];

  infos.forEach((info, i) => {
    const attrV = attrReg.attrVList[i];
    attrV.importSymbols.add(info.dictionaryFnId);
    // 如果只有一个，最终会被写入 handleText 生成的文件，文件里已经有依赖的符号，不需要使用 import 进来的添加 hash 后缀的符号。
    if (infos.length === 1) {
      dCode.push(info.dictionaryFnId);
    } else {
      dCode.push(`${info.dictionaryFnId}_${attrV.hash}`);
    }
  });

  const code = `export class ${componentName} extends AComponent {
  static d = [${dCode.join(', ')}];
}`;
  attrReg.componentCodes.push(code);

  let record = meta.outputJson.attribute[sourceFile];
  if (!record) meta.outputJson.attribute[sourceFile] = record = {};
  let info = record[attrHashes];
  if (info) {
    if (info.name !== componentName) throw 'unimpossible??';
    return;
  }
  info = { name: componentName };
  if (attrsParams.size > 0) {
    info.params = Object.fromEntries(Array.from(attrsParams.entries()));
  }
  record[attrHashes] = info;
}
export function handleHtml(source: string, sourceFile: string, dict: DictStore, meta: MetaStore) {
  const inodes = parseHtml(source);

  const walkNode = (node: INode) => {
    if (node.type === SyntaxKind.Text) {
      const originalText = node.value.trim();
      if (!originalText || !needTranslate(originalText)) return;
      handleText(originalText, sourceFile, meta, dict, node.loc.start);
    } else if (node.name !== '!--') {
      if (node.rawName === 'switch-locale' || node.rawName === 'SwitchLocaleComponent') {
        // 忽略 <switch-locale></switch-locale> 内部包裹的内容
        return;
      } else {
        handleAttrs(node, sourceFile, meta, dict);
        node.body?.forEach((cn) => walkNode(cn));
      }
    }
  };
  inodes.forEach((node) => walkNode(node));
}
