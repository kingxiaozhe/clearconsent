// T-006 5 站样例映射验证：转换正确性在本任务内闭环（不留给 F4 抽测回修）。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convert, validate } from '../../scripts/convert-rules.mjs';
import type { RuleSnapshot } from '../../utils/rules-format';

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = JSON.parse(
  readFileSync(path.join(here, '../../scripts/samples/consent-o-matic-subset.json'), 'utf-8'),
);

describe('C-o-M → 内部快照转换（5 站样例）', () => {
  const { snapshot, warnings } = convert(samples, '2026.07.18') as {
    snapshot: RuleSnapshot;
    warnings: string[];
  };

  it('转出 5 条规则（跳过 _note 元字段）', () => {
    expect(snapshot.rules).toHaveLength(5);
    expect(snapshot.rules.map((r) => r.id).sort()).toEqual([
      'cookiebot',
      'onetrust',
      'osano',
      'quantcast',
      'trustarc',
    ]);
  });

  it('结构校验通过', () => {
    expect(validate(snapshot)).toEqual([]);
  });

  it('探测器选择器完整保留', () => {
    const ot = snapshot.rules.find((r) => r.id === 'onetrust');
    expect(ot?.detect).toBe('#onetrust-banner-sdk');
  });

  it('REJECT_ALL 映射为拒绝档点击动作', () => {
    const cb = snapshot.rules.find((r) => r.id === 'cookiebot');
    expect(cb?.actions['essential-only'][0]).toMatchObject({
      kind: 'click',
      selector: '#CybotCookiebotDialogBodyButtonDecline',
    });
  });

  it('无 REJECT_ALL 的站点（TrustArc）拒绝档退化为隐藏并告警', () => {
    const ta = snapshot.rules.find((r) => r.id === 'trustarc');
    expect(ta?.actions['essential-only'][0].kind).toBe('hide');
    expect(warnings.some((w) => w.includes('trustarc') && w.includes('退化'))).toBe(true);
  });

  it('hide-only 档所有站点均有隐藏动作', () => {
    for (const r of snapshot.rules) {
      expect(r.actions['hide-only'][0].kind).toBe('hide');
    }
  });
});
