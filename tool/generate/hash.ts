function calcSimpleHash(text: string) {
  const buf = new TextEncoder().encode(text);
  let h = 9;
  for (let i = 0; i < buf.length; i++) {
    h = Math.imul(h ^ buf[i], 9 ** 9);
  }
  return (h ^ (h >>> 9)) >>> 0;
}

export class SimpleHasher {
  #store: Map<number, number>;
  constructor() {
    this.#store = new Map();
  }
  getHash(text: string) {
    const ihash = calcSimpleHash(text);
    let n = this.#store.get(ihash);
    if (n === undefined) {
      this.#store.set(ihash, (n = 0));
    } else {
      n++;
      this.#store.set(ihash, n);
    }
    return ihash.toString(32) + (n > 0 ? '_' + n.toString(32) : '');
  }
}
