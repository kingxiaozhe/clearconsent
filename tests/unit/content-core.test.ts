import { describe, it, expect, vi } from 'vitest';
import { runOnce, idempotencyKey, type ContentDeps } from '../../utils/content-core';
import type { CmpRule } from '../../utils/rules-format';
import type { SiteState, Strategy } from '../../utils/types';
import type { ExecResult } from '../../utils/executor';

const rule: CmpRule = {
  id: 'onetrust',
  name: 'OneTrust',
  detect: '#b',
  actions: { 'essential-only': [], 'reject-all-first': [], 'hide-only': [] },
};

function deps(over: Partial<ContentDeps> = {}): { d: ContentDeps; reports: unknown[] } {
  const reports: unknown[] = [];
  const d: ContentDeps = {
    site: 'example.com',
    now: () => 1000,
    href: () => 'https://example.com/page?x=1',
    getState: async (): Promise<SiteState> => ({
      site: 'example.com',
      enabled: true,
      whitelisted: false,
      lastResult: null,
    }),
    getStrategy: async (): Promise<Strategy> => 'essential-only',
    getRules: async () => [rule],
    detect: async () => ({ rule, element: {} as Element }),
    execute: async (): Promise<ExecResult> => ({
      outcome: 'handled',
      actions: [{ kind: 'hide', selector: '#b', label: '隐藏' }],
      strategyUsed: 'essential-only',
    }),
    report: async (r) => {
      reports.push(r);
    },
    ...over,
  };
  return { d, reports };
}

describe('runOnce', () => {
  it('正常处理并上报一条，url 去 query', async () => {
    const { d, reports } = deps();
    const handled = await runOnce(d, new Set());
    expect(handled).toBe(true);
    expect(reports).toHaveLength(1);
    expect((reports[0] as { url: string }).url).toBe('https://example.com/page');
  });

  it('白名单站点零操作零上报（AC-106）', async () => {
    const { d, reports } = deps({
      getState: async () => ({
        site: 'example.com',
        enabled: true,
        whitelisted: true,
        lastResult: null,
      }),
    });
    const exec = vi.fn();
    await runOnce({ ...d, execute: exec }, new Set());
    expect(exec).not.toHaveBeenCalled();
    expect(reports).toHaveLength(0);
  });

  it('全局暂停（enabled=false）零操作', async () => {
    const { d, reports } = deps({
      getState: async () => ({
        site: 'example.com',
        enabled: false,
        whitelisted: false,
        lastResult: null,
      }),
    });
    await runOnce(d, new Set());
    expect(reports).toHaveLength(0);
  });

  it('同一 CMP 二次调用被幂等跳过（AC-104 SPA 重复）', async () => {
    const { d, reports } = deps();
    const processed = new Set<string>();
    await runOnce(d, processed);
    await runOnce(d, processed);
    await runOnce(d, processed);
    expect(reports).toHaveLength(1); // 只一条
    expect(processed.has(idempotencyKey('example.com', 'onetrust'))).toBe(true);
  });

  it('skipped 不占幂等，允许后续重试', async () => {
    const { d } = deps({
      execute: async () => ({ outcome: 'skipped', actions: [], strategyUsed: 'essential-only' }),
    });
    const processed = new Set<string>();
    await runOnce(d, processed);
    expect(processed.size).toBe(0); // 未占键
  });

  it('无匹配时不处理', async () => {
    const { d, reports } = deps({ detect: async () => null });
    expect(await runOnce(d, new Set())).toBe(false);
    expect(reports).toHaveLength(0);
  });
});
