// 收据视图纯逻辑（可单测）：状态派生 + 7 天汇总 + HTML 片段渲染。
// 设计基准 V3 纸白（衬线大状态词 + 等宽收据）+ V2 徽章语言。DOM 装配在 popup/main.ts。
import type { ProcessResult, SiteState } from './types';

export type BadgeState = 'handled' | 'paused' | 'whitelisted' | 'untouched';

const BADGE_TEXT: Record<BadgeState, string> = {
  handled: '已处理',
  paused: '已暂停',
  whitelisted: '信任站点',
  untouched: '未处理',
};

/** SiteState → 徽章状态。白名单 > 暂停 > 已处理 > 未处理。 */
export function deriveState(state: SiteState): BadgeState {
  if (state.whitelisted) return 'whitelisted';
  if (!state.enabled) return 'paused';
  if (state.lastResult?.outcome === 'handled') return 'handled';
  return 'untouched';
}

export interface WeekSummary {
  sitesHandled: number;
  actionsTotal: number;
}

/** 近 7 天汇总：处理过的不同站点数、动作总数。 */
export function summarize(log: ProcessResult[], now: number): WeekSummary {
  const since = now - 7 * 24 * 60 * 60 * 1000;
  const recent = log.filter((r) => r.ts >= since && r.outcome === 'handled');
  const sites = new Set(recent.map((r) => r.site));
  const actionsTotal = recent.reduce((n, r) => n + r.actions.length, 0);
  return { sitesHandled: sites.size, actionsTotal };
}

// --- 渲染（返回 HTML 字符串；调用方用 textContent/受信模板注入，数据来自本机不含外部输入） ---

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function badgeHtml(state: BadgeState): string {
  return `<span class="badge badge--${state}">${BADGE_TEXT[state]}</span>`;
}

/** 处理收据：等宽字 + 虚线分隔的动作明细（V3 母题「透明=可审计小票」）。 */
export function receiptHtml(state: BadgeState, result: ProcessResult | null): string {
  if (state === 'whitelisted') return `<p class="receipt-empty">本站在信任清单，扩展不介入。</p>`;
  if (state === 'paused') return `<p class="receipt-empty">扩展在本站已暂停。</p>`;
  if (!result || state === 'untouched')
    return `<p class="receipt-empty">本站尚未处理 cookie 弹窗。</p>`;

  const lines = result.actions
    .map((a) => `<div class="receipt-line"><span class="k">${esc(a.label)}</span></div>`)
    .join('');
  const strategyText =
    {
      'essential-only': '仅必要 Cookie',
      'reject-all-first': '全部拒绝优先',
      'hide-only': '只隐藏',
    }[result.strategy] ?? result.strategy;
  return `
    <div class="receipt">
      <div class="receipt-line receipt-head"><span class="k">处 理 收 据</span><span class="v">${strategyText}</span></div>
      ${lines}
      <div class="receipt-line"><span class="k">0 条数据离开本机</span><span class="v">始终</span></div>
    </div>`;
}

export function summaryHtml(s: WeekSummary): string {
  return `<div class="summary">近 7 天 · <b>${s.sitesHandled}</b> 个站点 · <b>${s.actionsTotal}</b> 次处理</div>`;
}

/** options 透明日志表。siteFilter 非空时只显该站。空态给文案。 */
export function logTableHtml(rows: ProcessResult[], siteFilter: string | null): string {
  const filtered = siteFilter ? rows.filter((r) => r.site === siteFilter) : rows;
  if (filtered.length === 0) return `<p class="receipt-empty">暂无记录。</p>`;
  const body = filtered
    .slice()
    .reverse()
    .map((r) => {
      const time = new Date(r.ts).toLocaleString('zh-CN', { hour12: false });
      const acts = r.actions.map((a) => esc(a.label)).join('；') || '（无动作）';
      return `<tr><td>${esc(time)}</td><td>${esc(r.site)}</td><td>${esc(acts)}</td><td>${esc(r.ruleId)}</td></tr>`;
    })
    .join('');
  return `<table class="log"><thead><tr><th>时间</th><th>站点</th><th>动作</th><th>规则</th></tr></thead><tbody>${body}</tbody></table>`;
}
