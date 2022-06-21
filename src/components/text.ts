import { $$, Attributes, Component, createFragment, isComponent, RenderFn, setText, textRenderFn, __ } from 'jinge';
import { watchForComponent, getLocale } from '../core/service';

type TFn = (ctx?: unknown) => string;
export class TComponent extends Component {
  p: boolean;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  t(locale: string): string | TFn {
    throw new Error('abstract method');
  }
  constructor(attrs: Attributes, hasParams = false) {
    super(attrs);
    this.p = hasParams;
    attrs[$$].__watch('**', () => {
      this.__updateIfNeed();
    });
    watchForComponent(this, () => {
      this.__updateIfNeed();
    });
  }
  r() {
    const txtOrFn = this.t(getLocale());
    if (this.p) {
      return (txtOrFn as TFn)(this[__].passedAttrs);
    } else {
      return txtOrFn as string;
    }
  }
  __render(): Node[] {
    return [textRenderFn(this, this.r())];
  }
  __update(): void {
    setText(this[__].rootNodes[0] as HTMLElement, this.r());
  }
}

export class TPComponent extends TComponent {
  constructor(attrs: Attributes) {
    super(attrs, true);
  }
}

/**
 * 用于包裹带有需要国际化的属性（Attribute）的组件。
 * 比如 <S :k="你好" /> 会被转换为 <AComponent vm:ctx="ctx"><S :k={ctx.t0} /></AComponent>
 */
export class AComponent extends Component {
  constructor(attrs: Attributes) {
    super(attrs);
    attrs[$$].__watch('**', () => {
      this.__updateIfNeed();
    });
  }
}

export class RComponent extends AComponent {
  d: Record<string, RenderFn>;
  constructor(attrs: Attributes) {
    super(attrs);
  }
  __render(): Node[] {
    const renderFn = this.d[getLocale()];
    return renderFn(this);
  }
  __update() {
    if (this[$$].__related) {
      this[$$].__related.forEach((hooks, origin) => {
        hooks.forEach((hook) => {
          origin.__unwatch(hook.prop, hook.handler);
        });
      });
      this[$$].__related.clear();
    }

    let $el = this.__lastDOM;
    const $parentEl = $el.parentNode;
    $el = $el.nextSibling;

    /*
     * 当前实现下，HANDLE_BEFORE_DESTROY 正好可以销毁子组件/子元素。
     * 但要注意，还需要手动清空旧的 rootNodes 和 nonRootCompNodes。
     */
    this.__handleBeforeDestroy(true);
    this[__].rootNodes.length = 0;
    this[__].nonRootCompNodes.length = 0;
    /*
     * 将新的元素替换到原来的旧的元素的位置。
     */
    const els = this.__render();
    if ($el) {
      $parentEl.insertBefore(els.length > 1 ? createFragment(els) : els[0], $el);
    } else {
      $parentEl.appendChild(els.length > 1 ? createFragment(els) : els[0]);
    }

    /**
     * 对切换后渲染的组件触发 AFTER_RENDER 生命周期。
     */
    this[__].rootNodes.forEach((n) => {
      if (isComponent(n)) (n as Component).__handleAfterRender();
    });
    this[__].nonRootCompNodes.forEach((n) => {
      (n as Component).__handleAfterRender();
    });
  }
}
