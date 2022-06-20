import { Component } from 'jinge';

export type LocaleListener = (locale: string) => void;

let currentLocale: string = (window as unknown as { I18N_DEFAULT_LOCALE: string }).I18N_DEFAULT_LOCALE || undefined;
const listeners: Set<LocaleListener> = new Set();

export function getLocale() {
  return currentLocale;
}

export function setLocale(locale: string) {
  if (currentLocale === locale) return;
  currentLocale = locale;
  listeners.forEach((fn) => fn(currentLocale));
}

export function watch(fn: LocaleListener, immediate = false) {
  if (immediate && currentLocale) fn(currentLocale);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function unwatch(fn: LocaleListener) {
  listeners.delete(fn);
}

export function watchForComponent(component: Component, fn: LocaleListener, immediate = false) {
  component.__addDeregisterFn(watch(fn, immediate));
}

export const w = watch;
export const cw = watchForComponent;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function t(message: string) {
  throw new Error('DONT USE COMPILER FUNCTION');
}
