import {
  Attributes,
  Component,
  attrs as wrapAttrs,
  __,
  createElementWithoutAttrs,
  isComponent,
  createFragment,
} from 'jinge';
import { watchForComponent, getLocale } from '../core/service';

function createEl(component: Component) {
  const locale = getLocale();
  const renderFn = component[__].slots[locale];
  if (!renderFn) {
    return createElementWithoutAttrs('span', `missing ${locale} content`);
  }
  const attrs = wrapAttrs({
    [__]: {
      context: component[__].context,
      slots: {
        default: renderFn,
      },
    },
  });
  return Component.create(attrs);
}

/**
 * 手动指定语言切换时的渲染函数，用于复杂场景。比如
 * ```html
 * <switch-locale>
 * <_slot slot-pass:zh_cn>中文</_slot>
 * <p slot-pass:en>English</p>
 * </switch-locale>
 * ```
 * 被该组件包裹的内容里的文本字符串不会被抽取和翻译。
 */
export class SwitchLocaleComponent extends Component {
  constructor(attrs: Attributes) {
    super(attrs);
    watchForComponent(this, () => {
      this.__updateIfNeed();
    });
  }

  __doRender() {
    const el = createEl(this);
    const roots = this[__].rootNodes;
    roots.push(el);
    return isComponent(el) ? el.__render() : (roots as Node[]);
  }

  async __update() {
    const roots = this[__].rootNodes;
    const el = roots[0];
    const fd = isComponent(el) ? el.__firstDOM : el;
    const pa = fd.parentNode as HTMLElement;
    const newEl = createEl(this);
    roots[0] = newEl;
    if (isComponent(newEl)) {
      const nels = await newEl.__render();
      pa.insertBefore(nels.length > 1 ? createFragment(nels) : nels[0], fd);
    } else {
      pa.insertBefore(newEl, fd);
    }
    if (isComponent(el)) {
      await el.__destroy();
    } else {
      pa.removeChild(el);
    }
    if (isComponent(newEl)) {
      await newEl.__handleAfterRender();
    }
  }
}
