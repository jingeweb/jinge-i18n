import path from 'path';
import { getJingeTemplateRuleWithAlias, JingeComponentRule } from 'jinge-compiler';

export const JingeI18NLoader = path.resolve(__dirname, './webpack/template-loader.js');

export const JingeI18NComponentRule = {
  test: JingeComponentRule.test,
  use: [JingeComponentRule.use, JingeI18NLoader],
};

export const I18NAlias = {
  'jinge-i18n': {
    SwitchLocaleComponent: 'switch-locale',
  },
};

export function getJingeI18NTemplateRuleWithAlias(alias: Record<string, unknown>) {
  const rule = getJingeTemplateRuleWithAlias({
    ...alias,
    ...I18NAlias,
  });
  return {
    test: rule.test,
    use: [rule.use, JingeI18NLoader],
  };
}

export function getJingeI18NRulesWithAlias(alias: Record<string, unknown>) {
  return [JingeI18NComponentRule, getJingeI18NTemplateRuleWithAlias(alias)];
}

export const JingeI18NTemplateRule = getJingeI18NTemplateRuleWithAlias({});

export const JingeI18NRules = [JingeI18NComponentRule, JingeI18NTemplateRule];
