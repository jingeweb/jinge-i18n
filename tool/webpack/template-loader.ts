import { LoaderContext } from 'webpack';
import { DICT_FILENAME, loadDict } from '../dict';

let ef = false;
async function loader(this: LoaderContext<unknown>, source: string) {
  const { map, dict } = await loadDict();
  if (!ef) {
    ef = true;
    this.emitFile(DICT_FILENAME, dict);
  }
  
  return source;
}
export default function JingeI18NTemplateLoader(this: LoaderContext<unknown>, source: string) {
  const callback = this.async();
  loader.call(this, source).then((code: string) => callback(null, code), callback);
}
