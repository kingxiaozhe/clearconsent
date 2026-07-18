// 规则加载：storage 优先（F4 远程快照），内置兜底。按 hostname 过滤下发。
// SW 侧使用——content 不直接读 storage 规则，经消息拿过滤后的子集（避免全量规则进页面，性能）。

import { BUILTIN_SNAPSHOT } from './builtin-rules';
import { validateSnapshot, type CmpRule, type RuleSnapshot } from './rules-format';

/** 取当前生效快照：storage 有且合法则用它，否则内置兜底（F4 拉取失败也安全）。 */
export async function loadSnapshot(): Promise<RuleSnapshot> {
  try {
    const got = await chrome.storage.local.get('rules');
    const stored = got.rules as unknown;
    if (stored && validateSnapshot(stored).length === 0) {
      return stored as RuleSnapshot;
    }
  } catch {
    /* storage 异常 → 兜底 */
  }
  return BUILTIN_SNAPSHOT;
}

/**
 * 按 hostname 过滤规则：hosts 为空/缺省 = 全局通用；否则 hostname 命中 hosts 后缀之一才保留。
 * 纯函数，单测覆盖。
 */
export function filterByHost(rules: CmpRule[], hostname: string): CmpRule[] {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  return rules.filter((r) => {
    if (!r.hosts || r.hosts.length === 0) return true;
    return r.hosts.some((h) => {
      const base = h.toLowerCase().replace(/^www\./, '');
      return host === base || host.endsWith('.' + base);
    });
  });
}
