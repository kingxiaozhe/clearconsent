// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { executeStrategy } from '../../utils/executor';
import type { CmpRule } from '../../utils/rules-format';

// 造一个带「拒绝」按钮与容器的规则，click 记录到 window 以便断言
function ruleWith(hasReject: boolean): CmpRule {
  return {
    id: 't',
    name: 'T',
    detect: '#banner',
    actions: {
      'essential-only': [{ kind: 'click', selector: '#essential', label: '仅必要' }],
      'reject-all-first': hasReject
        ? [{ kind: 'click', selector: '#reject', label: '全部拒绝' }]
        : [{ kind: 'click', selector: '#reject', label: '全部拒绝' }], // 选择器在，但 DOM 里不放 → 未命中
      'hide-only': [{ kind: 'hide', selector: '#banner', label: '隐藏横幅' }],
    },
  };
}

describe('executeStrategy', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hide-only 隐藏容器并记录动作', async () => {
    document.body.innerHTML = '<div id="banner">x</div>';
    const r = await executeStrategy(ruleWith(true), 'hide-only', { perActionTimeoutMs: 100 });
    expect(r.outcome).toBe('handled');
    expect(r.actions[0].kind).toBe('hide');
    expect((document.querySelector('#banner') as HTMLElement).style.display).toBe('none');
  });

  it('essential-only 点击对应按钮', async () => {
    let clicked = false;
    document.body.innerHTML = '<div id="banner"></div><button id="essential"></button>';
    document.querySelector('#essential')!.addEventListener('click', () => (clicked = true));
    const r = await executeStrategy(ruleWith(true), 'essential-only', { perActionTimeoutMs: 100 });
    expect(clicked).toBe(true);
    expect(r.strategyUsed).toBe('essential-only');
  });

  it('reject-all-first 有拒绝按钮时点击拒绝', async () => {
    let rejected = false;
    document.body.innerHTML = '<div id="banner"></div><button id="reject"></button>';
    document.querySelector('#reject')!.addEventListener('click', () => (rejected = true));
    const r = await executeStrategy(ruleWith(true), 'reject-all-first', {
      perActionTimeoutMs: 100,
    });
    expect(rejected).toBe(true);
    expect(r.strategyUsed).toBe('reject-all-first');
  });

  it('reject-all-first 无拒绝路径时回退 essential-only', async () => {
    let essentialClicked = false;
    // 只放 essential 按钮，不放 reject
    document.body.innerHTML = '<div id="banner"></div><button id="essential"></button>';
    document
      .querySelector('#essential')!
      .addEventListener('click', () => (essentialClicked = true));
    const r = await executeStrategy(ruleWith(false), 'reject-all-first', {
      perActionTimeoutMs: 100,
    });
    expect(essentialClicked).toBe(true);
    expect(r.strategyUsed).toBe('essential-only'); // 回退发生
  });

  it('hide 后恢复被锁的滚动（成对恢复，槽点#2）', async () => {
    document.body.innerHTML = '<div id="banner"></div>';
    document.body.style.overflow = 'hidden';
    await executeStrategy(ruleWith(true), 'hide-only', { perActionTimeoutMs: 100 });
    expect(document.body.style.overflow).toBe('');
  });

  it('选择器全不存在时 outcome=skipped，零副作用', async () => {
    document.body.innerHTML = '<div>无关</div>';
    const r = await executeStrategy(ruleWith(true), 'hide-only', { perActionTimeoutMs: 50 });
    expect(r.outcome).toBe('skipped');
    expect(r.actions).toHaveLength(0);
  });

  it('非法选择器不抛错，静默返回', async () => {
    const bad: CmpRule = {
      id: 'b',
      name: 'b',
      detect: '#x',
      actions: {
        'essential-only': [{ kind: 'hide', selector: ':::bad', label: 'x' }],
        'reject-all-first': [{ kind: 'hide', selector: ':::bad', label: 'x' }],
        'hide-only': [{ kind: 'hide', selector: ':::bad', label: 'x' }],
      },
    };
    const r = await executeStrategy(bad, 'hide-only', { perActionTimeoutMs: 50 });
    expect(r.outcome).toBe('skipped'); // 坏选择器未命中，不崩
  });
});
