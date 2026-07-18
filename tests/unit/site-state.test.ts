import { describe, it, expect } from 'vitest';
import { computeSiteState, shouldProcess } from '../../utils/site-state';
import type { ProcessResult, Settings } from '../../utils/types';

const settings: Settings = { strategy: 'essential-only', globalEnabled: true };
const log: ProcessResult[] = [
  {
    site: 'a.com',
    url: 'https://a.com',
    strategy: 'essential-only',
    actions: [],
    durationMs: 10,
    outcome: 'handled',
    ruleId: 'r1',
    ts: 1,
  },
  {
    site: 'example.com',
    url: 'https://example.com',
    strategy: 'hide-only',
    actions: [],
    durationMs: 20,
    outcome: 'handled',
    ruleId: 'r2',
    ts: 2,
  },
];

describe('computeSiteState', () => {
  const base = { settings, whitelist: [], siteDisabled: [], log };

  it('默认站点 enabled=true, 非白名单', () => {
    const s = computeSiteState({ ...base, site: 'other.com' });
    expect(s.enabled).toBe(true);
    expect(s.whitelisted).toBe(false);
  });

  it('全局暂停时 enabled 恒 false', () => {
    const s = computeSiteState({
      ...base,
      site: 'other.com',
      settings: { ...settings, globalEnabled: false },
    });
    expect(s.enabled).toBe(false);
  });

  it('本站停用 → enabled false（www 归一）', () => {
    const s = computeSiteState({ ...base, site: 'www.example.com', siteDisabled: ['example.com'] });
    expect(s.enabled).toBe(false);
  });

  it('白名单命中', () => {
    const s = computeSiteState({ ...base, site: 'example.com', whitelist: ['example.com'] });
    expect(s.whitelisted).toBe(true);
  });

  it('lastResult 取本站最近一条', () => {
    const s = computeSiteState({ ...base, site: 'example.com' });
    expect(s.lastResult?.ruleId).toBe('r2');
  });

  it('无本站日志时 lastResult=null', () => {
    const s = computeSiteState({ ...base, site: 'none.com' });
    expect(s.lastResult).toBeNull();
  });
});

describe('shouldProcess', () => {
  it('enabled 且非白名单 → 处理', () => {
    expect(shouldProcess({ site: 'x', enabled: true, whitelisted: false, lastResult: null })).toBe(
      true,
    );
  });
  it('白名单 → 跳过', () => {
    expect(shouldProcess({ site: 'x', enabled: true, whitelisted: true, lastResult: null })).toBe(
      false,
    );
  });
  it('停用 → 跳过', () => {
    expect(shouldProcess({ site: 'x', enabled: false, whitelisted: false, lastResult: null })).toBe(
      false,
    );
  });
});
