// 共享 chrome.* mock（testing.md 红线：统一一处，禁止各测各 mock）。
// 覆盖单测用到的 storage.local；行为断言以 E2E 真实浏览器为准。

interface StorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  clear: () => Promise<void>;
}

export function makeChromeMock(initial: Record<string, unknown> = {}) {
  let store: Record<string, unknown> = structuredClone(initial);
  const local: StorageArea = {
    get: async (keys) => {
      if (keys == null) return structuredClone(store);
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (k in store) out[k] = structuredClone(store[k]);
      return out;
    },
    set: async (items) => {
      store = { ...store, ...structuredClone(items) };
    },
    clear: async () => {
      store = {};
    },
  };
  return {
    storage: { local },
    _dump: () => structuredClone(store),
    _reset: (s: Record<string, unknown> = {}) => {
      store = structuredClone(s);
    },
  };
}

/** 装到全局 chrome，返回 mock 句柄。 */
export function installChromeMock(initial: Record<string, unknown> = {}) {
  const mock = makeChromeMock(initial);
  (globalThis as unknown as { chrome: unknown }).chrome = mock;
  return mock;
}
