// chrome.storage.local 读写层。所有持久状态经此层，禁止散落裸调 chrome.storage。
// schema 版本位：结构变更必须递增 SCHEMA_VERSION 并在 migrate() 补迁移，防老用户数据炸裂。

import { DEFAULT_STRATEGY, type ProcessResult, type RulesMeta, type Settings } from './types';

export const SCHEMA_VERSION = 1;
export const LOG_LIMIT = 500;

interface Schema {
  schemaVersion: number;
  settings: Settings;
  whitelist: string[];
  siteDisabled: string[];
  log: ProcessResult[];
  'rules-meta': RulesMeta;
}

const DEFAULTS: Schema = {
  schemaVersion: SCHEMA_VERSION,
  settings: { strategy: DEFAULT_STRATEGY, globalEnabled: true },
  whitelist: [],
  siteDisabled: [],
  log: [],
  'rules-meta': { version: '0.0.0', siteCount: 0, source: 'builtin', updatedAt: 0 },
};

async function getRaw<K extends keyof Schema>(key: K): Promise<Schema[K]> {
  const got = await chrome.storage.local.get(key);
  return (got[key] as Schema[K]) ?? DEFAULTS[key];
}

// 串行写队列（N4 拦截）：MV3 下多个 content 并发上报，read-modify-write（如 appendLog）
// 若不串行会丢写；且首启 ensureSchema 与写入交错会被默认值覆盖。所有变更 storage 的操作
// 一律经 serialize()，天然按入队顺序执行——ensureSchema 顶层最先入队，后续写入排其后。
let writeChain: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  writeChain = run.catch(() => {});
  return run;
}

async function setRaw<K extends keyof Schema>(key: K, value: Schema[K]): Promise<void> {
  await serialize(() => chrome.storage.local.set({ [key]: value }));
}

/** 首次运行或版本落后时补齐默认值并迁移。SW 顶层调用一次（最先入写队列）。 */
export function ensureSchema(): Promise<void> {
  return serialize(async () => {
    const { schemaVersion } = await chrome.storage.local.get('schemaVersion');
    if (schemaVersion === SCHEMA_VERSION) return;
    // 迁移占位：未来 schemaVersion 落后时按版本逐级迁移。当前仅补默认值。
    const existing = await chrome.storage.local.get(null);
    const merged: Partial<Schema> = { schemaVersion: SCHEMA_VERSION };
    for (const key of Object.keys(DEFAULTS) as (keyof Schema)[]) {
      if (key === 'schemaVersion') continue;
      if (existing[key] === undefined) (merged as Record<string, unknown>)[key] = DEFAULTS[key];
    }
    await chrome.storage.local.set(merged);
  });
}

export const getSettings = () => getRaw('settings');
export const setSettings = (s: Settings) => setRaw('settings', s);

export const getWhitelist = () => getRaw('whitelist');
export const setWhitelist = (w: string[]) => setRaw('whitelist', w);

/**
 * 原子读改写（N4）：read-modify-write 整体进串行队列，避免「读在队列外」的并发末写覆盖。
 * UI 多处改白名单/本站开关时用它，不要 get 完再 set。
 */
function updateRaw<K extends keyof Schema>(
  key: K,
  fn: (cur: Schema[K]) => Schema[K],
): Promise<void> {
  return serialize(async () => {
    const got = await chrome.storage.local.get(key);
    const cur = (got[key] as Schema[K]) ?? DEFAULTS[key];
    await chrome.storage.local.set({ [key]: fn(cur) });
  });
}
export const updateWhitelist = (fn: (w: string[]) => string[]) => updateRaw('whitelist', fn);
export const updateSiteDisabled = (fn: (d: string[]) => string[]) => updateRaw('siteDisabled', fn);
export const updateSettings = (fn: (s: Settings) => Settings) => updateRaw('settings', fn);

export const getSiteDisabled = () => getRaw('siteDisabled');
export const setSiteDisabled = (d: string[]) => setRaw('siteDisabled', d);

export const getRulesMeta = () => getRaw('rules-meta');
export const setRulesMeta = (m: RulesMeta) => setRaw('rules-meta', m);

/** 规则本体（'rules' key，体量大不入 Schema；rules-loader 读时会经 validateSnapshot 兜底）。 */
export function setRawRules(snapshot: unknown): Promise<void> {
  return serialize(() => chrome.storage.local.set({ rules: snapshot }));
}

/** 原子写规则本体 + meta（N4：分写中断会导致 rules=新/meta=旧的不一致，此处一次 set 两键）。 */
export function setRulesAndMeta(snapshot: unknown, meta: RulesMeta): Promise<void> {
  return serialize(() => chrome.storage.local.set({ rules: snapshot, 'rules-meta': meta }));
}

export const getLog = () => getRaw('log');

/**
 * 环形队列写入：超 LOG_LIMIT 丢最旧。日志只进本机 storage，永不出网。
 * 整个 read-modify-write 包进单个 serialize()——保证并发上报不互相覆盖（N4 拦截的丢日志竞态）。
 */
export function appendLog(entry: ProcessResult): Promise<void> {
  return serialize(async () => {
    const got = await chrome.storage.local.get('log');
    const log = (got.log as ProcessResult[]) ?? [];
    log.push(entry);
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
    await chrome.storage.local.set({ log });
  });
}

export async function clearLog(): Promise<void> {
  await setRaw('log', []);
}
