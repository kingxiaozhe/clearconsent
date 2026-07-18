// 规则更新的 SW 副作用层（拉取+校验+落库）。纯逻辑在 rules-update.ts，此处只做 IO。
// 合规红线：只访问固定 GitHub Raw URL，不带任何用户数据（无 cookie/无标识参数）。
import { getRulesMeta, setRulesMeta, setRawRules } from './storage';
import {
  shouldUpdate,
  validateManifest,
  validateRemoteRules,
  type RemoteManifest,
} from './rules-update';

// 更新源（自建仓库发布 Consent-O-Matic 转换产物；真实部署时改为你的仓库 raw 地址）
const BASE = 'https://raw.githubusercontent.com/kingxiaozhe/clearconsent-rules/main';
const FETCH_TIMEOUT = 10_000;

async function fetchJson(url: string): Promise<{ text: string; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return { text, json: JSON.parse(text) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 检查并更新规则库。失败静默：只记 rules-meta.lastCheckError，现有规则不动（回退内置/上一版）。
 * 返回本次是否有更新落库。
 */
export async function checkForUpdate(): Promise<boolean> {
  const now = Date.now();
  try {
    const { json: mRaw } = await fetchJson(`${BASE}/manifest.json`);
    const mErrs = validateManifest(mRaw);
    if (mErrs.length) throw new Error(`manifest 非法: ${mErrs[0]}`);
    const manifest = mRaw as RemoteManifest;

    const meta = await getRulesMeta();
    if (!shouldUpdate(meta.version, manifest.version)) {
      await setRulesMeta({ ...meta, lastCheckAt: now, lastCheckError: null });
      return false; // 已是最新
    }

    const { text } = await fetchJson(`${BASE}/rules.json`);
    const result = validateRemoteRules(text, manifest);
    if ('errors' in result) throw new Error(`规则校验失败: ${result.errors[0]}`);

    await setRawRules(result.snapshot);
    await setRulesMeta({
      version: manifest.version,
      siteCount: manifest.siteCount,
      source: 'remote',
      updatedAt: now,
      lastCheckAt: now,
      lastCheckError: null,
    });
    return true;
  } catch (e) {
    const meta = await getRulesMeta();
    await setRulesMeta({ ...meta, lastCheckAt: now, lastCheckError: String(e).slice(0, 200) });
    return false;
  }
}
