import { LoaderContext } from 'webpack';
import { transform } from '../transform';

export default function JingeI18NLoader(this: LoaderContext<unknown>, source: string, map: string) {
  const callback = this.async();
  transform(source, this.resourcePath).then((code: string) => callback(null, code, map), callback);
}
