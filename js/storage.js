// Browser storage may be missing, inaccessible, or full.
export const store = {
  get(key, fallback, storage) {
    try {
      const value = (storage === undefined ? globalThis.localStorage : storage).getItem(key);
      return value == null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value, storage) {
    try {
      (storage === undefined ? globalThis.localStorage : storage).setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
