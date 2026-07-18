// 站点状态计算（纯函数，SW 侧 get-site-state 与 content 侧跳过判断共用）。
import type { ProcessResult, Settings, SiteState } from './types';
import { normalizeHost } from './host';

export interface SiteStateInput {
  site: string;
  settings: Settings;
  whitelist: string[];
  siteDisabled: string[];
  log: ProcessResult[];
}

export function computeSiteState(input: SiteStateInput): SiteState {
  const host = normalizeHost(input.site);
  const inList = (list: string[]) => list.some((h) => normalizeHost(h) === host);
  const whitelisted = inList(input.whitelist);
  // 本站开关：全局暂停 或 本站停用 → false
  const enabled = input.settings.globalEnabled && !inList(input.siteDisabled);
  // 本站最近一条日志（供 popup 收据）
  let lastResult: ProcessResult | null = null;
  for (let i = input.log.length - 1; i >= 0; i--) {
    if (normalizeHost(input.log[i].site) === host) {
      lastResult = input.log[i];
      break;
    }
  }
  return { site: host, enabled, whitelisted, lastResult };
}

/** content 侧：是否应处理本站。停用或白名单 → 跳过（FR-107 / AC-106）。 */
export function shouldProcess(state: SiteState): boolean {
  return state.enabled && !state.whitelisted;
}
