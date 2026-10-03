/**
 * Short random ids, same shape as the nanoid library (A-Za-z0-9_-), without the dependency.
 * Uses the Web Crypto API, which exists in browsers and in Node 20+.
 */
const ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

export function nanoid(size = 21): string {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < size; i++) id += ALPHABET[bytes[i] & 63];
  return id;
}
