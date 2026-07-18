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

async function setRaw<K extends keyof Schema>(key: K, value: Schema[K]): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/** 首次运行或版本落后时补齐默认值并迁移。SW 顶层调用一次。 */
export async function ensureSchema(): Promise<void> {
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
}

export const getSettings = () => getRaw('settings');
export const setSettings = (s: Settings) => setRaw('settings', s);

export const getWhitelist = () => getRaw('whitelist');
export const setWhitelist = (w: string[]) => setRaw('whitelist', w);

export const getSiteDisabled = () => getRaw('siteDisabled');
export const setSiteDisabled = (d: string[]) => setRaw('siteDisabled', d);

export const getRulesMeta = () => getRaw('rules-meta');
export const setRulesMeta = (m: RulesMeta) => setRaw('rules-meta', m);

export const getLog = () => getRaw('log');

/** 环形队列写入：超 LOG_LIMIT 丢最旧。日志只进本机 storage，永不出网。 */
export async function appendLog(entry: ProcessResult): Promise<void> {
  const log = await getRaw('log');
  log.push(entry);
  if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  await setRaw('log', log);
}

export async function clearLog(): Promise<void> {
  await setRaw('log', []);
}
