import { LoaderContext } from 'webpack';
import { transform } from '../transform';

export default function JingeI18NTemplateLoader(this: LoaderContext<unknown>, source: string) {
  const callback = this.async();
  transform(source, this.resourcePath).then((code: string) => callback(null, code), callback);
}
