import path from 'path';
import { getJingeTemplateRuleWithAlias, JingeComponentRule, JingeTemplateRule } from 'jinge-compiler';

export const JingeI18NTemplateLoader = path.resolve(__dirname, './webpack/template-loader.js');

export const JingeI18NComponentRule = {
  test: JingeComponentRule.test,
  use: [JingeComponentRule.use],
};

export const JingeI18NTemplateRule = {
  test: /\.html$/,
  use: [JingeTemplateRule.use, JingeI18NTemplateLoader],
};

/**
 * 用于快速配置 jinge-loader 的 rules：
 * .c.{ts,js} 结尾的文件，或 .c 结尾的目录下的 index.{ts,js} 文件，使用 JingeComponentLoader 处理。
 * .html 结尾的文件，使用 JingeTemplateLoader 处理。
 **/
export const JingeI18NRules = [JingeI18NComponentRule, JingeI18NTemplateRule];

export function getJingeI18NTemplateRuleWithAlias(alias: unknown) {
  const rule = getJingeTemplateRuleWithAlias(alias);
  return {
    test: rule.test,
    use: [rule.use, JingeI18NTemplateLoader],
  };
}
