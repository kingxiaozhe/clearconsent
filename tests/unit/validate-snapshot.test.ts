// validateSnapshot 是 F4 远程规则落库的安全闸（AC-107 纯数据红线）。
// 对抗测试：喂畸形/恶意快照，闸必须拒绝而非崩溃或放行（N4 拦截：此闸此前零测试）。
import { describe, it, expect } from 'vitest';
import { validateSnapshot } from '../../utils/rules-format';
import { BUILTIN_SNAPSHOT } from '../../utils/builtin-rules';

const valid = () => structuredClone(BUILTIN_SNAPSHOT);

describe('validateSnapshot 安全闸', () => {
  it('内置快照本身合法', () => {
    expect(validateSnapshot(BUILTIN_SNAPSHOT)).toEqual([]);
  });

  it('null 动作不打崩校验器，而是被拒（N4 拦截点）', () => {
    const s = valid();
    (s.rules[0].actions['hide-only'] as unknown[])[0] = null;
    const errs = validateSnapshot(s);
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.some((e) => e.includes('非对象或 null'))).toBe(true);
  });

  it('根层夹带非法字段被拒（纯数据红线）', () => {
    const s = { ...valid(), script: 'fetch(evil).then(eval)' };
    expect(validateSnapshot(s).some((e) => e.includes('script') && e.includes('红线'))).toBe(true);
  });

  it('规则层夹带非法字段被拒', () => {
    const s = valid();
    (s.rules[0] as unknown as Record<string, unknown>).onload = 'alert(1)';
    expect(validateSnapshot(s).some((e) => e.includes('onload') && e.includes('红线'))).toBe(true);
  });

  it('动作层夹带非法字段被拒', () => {
    const s = valid();
    (s.rules[0].actions['hide-only'][0] as unknown as Record<string, unknown>).code = 'eval(x)';
    expect(validateSnapshot(s).some((e) => e.includes('code') && e.includes('红线'))).toBe(true);
  });

  it('空 selector 被拒', () => {
    const s = valid();
    s.rules[0].actions['hide-only'][0].selector = '';
    expect(validateSnapshot(s).some((e) => e.includes('selector'))).toBe(true);
  });

  it('非对象/非数组根节点安全拒绝', () => {
    expect(validateSnapshot(null).length).toBeGreaterThan(0);
    expect(validateSnapshot('str').length).toBeGreaterThan(0);
    expect(
      validateSnapshot({ version: 'x', source: 'y', rules: 'not-array' }).length,
    ).toBeGreaterThan(0);
  });

  it('重复 id 被拒', () => {
    const s = valid();
    s.rules[1].id = s.rules[0].id;
    expect(validateSnapshot(s).some((e) => e.includes('重复'))).toBe(true);
  });
});
