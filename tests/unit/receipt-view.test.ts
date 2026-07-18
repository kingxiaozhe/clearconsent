import { describe, it, expect } from 'vitest';
import {
  deriveState,
  summarize,
  receiptHtml,
  logTableHtml,
  badgeHtml,
} from '../../utils/receipt-view';
import type { ProcessResult, SiteState } from '../../utils/types';

const mkResult = (site: string, ts: number, actions = 1): ProcessResult => ({
  site,
  url: `https://${site}`,
  strategy: 'essential-only',
  actions: Array.from({ length: actions }, (_, i) => ({
    kind: 'click',
    selector: `#b${i}`,
    label: `动作${i}`,
  })),
  durationMs: 10,
  outcome: 'handled',
  ruleId: 'onetrust',
  ts,
});

const state = (o: Partial<SiteState>): SiteState => ({
  site: 'x.com',
  enabled: true,
  whitelisted: false,
  lastResult: null,
  ...o,
});

describe('deriveState', () => {
  it('白名单优先', () => {
    expect(deriveState(state({ whitelisted: true, enabled: false }))).toBe('whitelisted');
  });
  it('停用 → paused', () => {
    expect(deriveState(state({ enabled: false }))).toBe('paused');
  });
  it('有已处理结果 → handled', () => {
    expect(deriveState(state({ lastResult: mkResult('x.com', 1) }))).toBe('handled');
  });
  it('无结果 → untouched', () => {
    expect(deriveState(state({}))).toBe('untouched');
  });
});

describe('summarize', () => {
  const now = 1_000_000_000_000;
  it('只统计近 7 天已处理', () => {
    const log = [
      mkResult('a.com', now - 1000, 2),
      mkResult('b.com', now - 1000, 1),
      mkResult('old.com', now - 8 * 24 * 3600 * 1000, 5), // 8 天前,排除
    ];
    const s = summarize(log, now);
    expect(s.sitesHandled).toBe(2);
    expect(s.actionsTotal).toBe(3);
  });
  it('同站去重计数', () => {
    const log = [mkResult('a.com', now - 1000), mkResult('a.com', now - 2000)];
    expect(summarize(log, now).sitesHandled).toBe(1);
  });
});

describe('receiptHtml', () => {
  it('whitelisted/paused/untouched 各有空态文案', () => {
    expect(receiptHtml('whitelisted', null)).toContain('信任清单');
    expect(receiptHtml('paused', null)).toContain('已暂停');
    expect(receiptHtml('untouched', null)).toContain('尚未处理');
  });
  it('handled 渲染收据含动作与策略', () => {
    const html = receiptHtml('handled', mkResult('x.com', 1));
    expect(html).toContain('处 理 收 据');
    expect(html).toContain('仅必要 Cookie');
    expect(html).toContain('0 条数据离开本机');
  });
  it('转义用户不可控字段防注入', () => {
    const r = mkResult('x.com', 1);
    r.actions = [{ kind: 'hide', selector: 'x', label: '<img src=x onerror=alert(1)>' }];
    expect(receiptHtml('handled', r)).not.toContain('<img src=x');
  });
});

describe('logTableHtml', () => {
  const rows = [mkResult('a.com', 1), mkResult('b.com', 2)];
  it('空日志给空态', () => {
    expect(logTableHtml([], null)).toContain('暂无记录');
  });
  it('站点筛选生效', () => {
    const html = logTableHtml(rows, 'a.com');
    expect(html).toContain('a.com');
    expect(html).not.toContain('b.com');
  });
  it('动作 label 单次转义不双重转义（N4）', () => {
    const r = mkResult('a.com', 1);
    r.actions = [{ kind: 'hide', selector: 'x', label: 'a<b' }];
    const html = logTableHtml([r], null);
    expect(html).toContain('a&lt;b');
    expect(html).not.toContain('&amp;lt;'); // 无双重转义
  });
  it('畸形 strategy 回退值被转义（N4）', () => {
    const r = mkResult('a.com', 1);
    (r as { strategy: string }).strategy = '<script>';
    expect(receiptHtml('handled', r)).not.toContain('<script>');
  });
  it('badgeHtml 输出对应文案', () => {
    expect(badgeHtml('handled')).toContain('已处理');
  });
});
