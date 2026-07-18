import { describe, it, expect } from 'vitest';
import { filterByHost, loadSnapshot } from '../../utils/rules-loader';
import { BUILTIN_SNAPSHOT } from '../../utils/builtin-rules';
import type { CmpRule } from '../../utils/rules-format';
import { installChromeMock } from '../mocks/chrome';

const mk = (id: string, hosts?: string[]): CmpRule => ({
  id,
  name: id,
  detect: `#${id}`,
  hosts,
  actions: { 'essential-only': [], 'reject-all-first': [], 'hide-only': [] },
});

describe('filterByHost', () => {
  const rules = [mk('global'), mk('exact', ['example.com']), mk('sub', ['news.site'])];

  it('全局规则（无 hosts）总是保留', () => {
    expect(filterByHost(rules, 'random.org').map((r) => r.id)).toContain('global');
  });

  it('精确 host 命中', () => {
    expect(filterByHost(rules, 'example.com').map((r) => r.id)).toEqual(['global', 'exact']);
  });

  it('www. 前缀归一后命中', () => {
    expect(filterByHost(rules, 'www.example.com').map((r) => r.id)).toContain('exact');
  });

  it('子域后缀命中', () => {
    expect(filterByHost(rules, 'a.b.news.site').map((r) => r.id)).toContain('sub');
  });

  it('不匹配的 host 只留全局', () => {
    expect(filterByHost(rules, 'other.com').map((r) => r.id)).toEqual(['global']);
  });
});

describe('loadSnapshot', () => {
  it('storage 无规则时用内置快照', async () => {
    installChromeMock({});
    expect((await loadSnapshot()).source).toBe(BUILTIN_SNAPSHOT.source);
  });

  it('storage 有合法快照时优先用它', async () => {
    const custom = { version: '9.9', source: 'remote', rules: [mk('x')] };
    installChromeMock({ rules: custom });
    const snap = await loadSnapshot();
    expect(snap.version).toBe('9.9');
    expect(snap.rules[0].id).toBe('x');
  });

  it('storage 快照非法时回退内置（不采信坏数据）', async () => {
    installChromeMock({ rules: { version: 1, rules: 'bad' } });
    expect((await loadSnapshot()).source).toBe(BUILTIN_SNAPSHOT.source);
  });
});
