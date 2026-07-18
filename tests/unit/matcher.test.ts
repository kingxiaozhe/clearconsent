// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { matchNow, detectCmp } from '../../utils/matcher';
import type { CmpRule } from '../../utils/rules-format';

const rules: CmpRule[] = [
  {
    id: 'a',
    name: 'A',
    detect: '#cmp-a',
    actions: { 'essential-only': [], 'reject-all-first': [], 'hide-only': [] },
  },
  {
    id: 'b',
    name: 'B',
    detect: '.cmp-b-banner',
    actions: { 'essential-only': [], 'reject-all-first': [], 'hide-only': [] },
  },
];

describe('matchNow', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('命中存在的 detect 选择器', () => {
    document.body.innerHTML = '<div class="cmp-b-banner">x</div>';
    expect(matchNow(rules)?.rule.id).toBe('b');
  });

  it('无匹配返回 null', () => {
    document.body.innerHTML = '<div>nothing</div>';
    expect(matchNow(rules)).toBeNull();
  });

  it('多规则命中时返回规则数组中的第一个', () => {
    document.body.innerHTML = '<div id="cmp-a"></div><div class="cmp-b-banner"></div>';
    expect(matchNow(rules)?.rule.id).toBe('a');
  });

  it('非法选择器不打断匹配，跳过后继续', () => {
    const bad: CmpRule[] = [
      {
        id: 'bad',
        name: 'bad',
        detect: '::::invalid',
        actions: { 'essential-only': [], 'reject-all-first': [], 'hide-only': [] },
      },
      ...rules,
    ];
    document.body.innerHTML = '<div id="cmp-a"></div>';
    expect(matchNow(bad)?.rule.id).toBe('a');
  });
});

describe('detectCmp（异步）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('立即存在时同步命中', async () => {
    document.body.innerHTML = '<div id="cmp-a"></div>';
    const m = await detectCmp(rules, { timeoutMs: 500 });
    expect(m?.rule.id).toBe('a');
  });

  it('弹窗延迟注入时观察命中', async () => {
    const p = detectCmp(rules, { timeoutMs: 2000 });
    setTimeout(() => {
      document.body.innerHTML = '<div class="cmp-b-banner"></div>';
    }, 50);
    const m = await p;
    expect(m?.rule.id).toBe('b');
  });

  it('超时无弹窗返回 null', async () => {
    const m = await detectCmp(rules, { timeoutMs: 200 });
    expect(m).toBeNull();
  });

  it('整个 <html> 被替换后新树中的 CMP 仍能命中（N4 换根拦截）', async () => {
    const p = detectCmp(rules, { timeoutMs: 2000 });
    setTimeout(() => {
      const html = document.createElement('html');
      html.innerHTML = '<body><div id="cmp-a"></div></body>';
      document.replaceChild(html, document.documentElement);
    }, 50);
    const m = await p;
    expect(m?.rule.id).toBe('a');
  });
});
