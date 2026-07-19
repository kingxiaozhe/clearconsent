// @vitest-environment jsdom
// 用真实内置规则 + 执行器验证新增 CMP（Sourcepoint/Usercentrics/TCF），不依赖浏览器 E2E。
import { describe, it, expect, beforeEach } from 'vitest';
import { BUILTIN_SNAPSHOT } from '../../utils/builtin-rules';
import { matchNow } from '../../utils/matcher';
import { executeStrategy } from '../../utils/executor';
import type { CmpRule } from '../../utils/rules-format';

const rule = (id: string): CmpRule => {
  const r = BUILTIN_SNAPSHOT.rules.find((x) => x.id === id);
  if (!r) throw new Error(`规则 ${id} 不存在`);
  return r;
};

describe('新增 CMP 内置规则（覆盖率缺口补充）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('内置快照现含 10 个 CMP（7 原有 + Sourcepoint/Usercentrics/TCF）', () => {
    const ids = BUILTIN_SNAPSHOT.rules.map((r) => r.id);
    expect(ids).toContain('sourcepoint');
    expect(ids).toContain('usercentrics');
    expect(ids).toContain('tcf-generic');
    expect(ids.length).toBe(10);
  });

  it('Sourcepoint：detect 命中 sp_message_container', () => {
    document.body.innerHTML = '<div id="sp_message_container_123">privacy</div>';
    expect(matchNow(BUILTIN_SNAPSHOT.rules)?.rule.id).toBe('sourcepoint');
  });

  it('Sourcepoint 无拒绝按钮时兜底隐藏容器（essential-only）', async () => {
    document.body.innerHTML =
      '<div id="sp_message_container_998"><button title="Accept">Accept</button></div>';
    const r = await executeStrategy(rule('sourcepoint'), 'essential-only', {
      perActionTimeoutMs: 50,
    });
    expect(r.outcome).toBe('handled');
    expect((document.querySelector('#sp_message_container_998') as HTMLElement).style.display).toBe(
      'none',
    );
  });

  it('Sourcepoint 有 Reject 按钮时点击拒绝（不误点 Accept）', async () => {
    let rejected = false;
    let accepted = false;
    document.body.innerHTML =
      '<div id="sp_message_container_1"><button title="Reject">Reject</button><button title="Accept">Accept</button></div>';
    document
      .querySelector('button[title="Reject"]')!
      .addEventListener('click', () => (rejected = true));
    document
      .querySelector('button[title="Accept"]')!
      .addEventListener('click', () => (accepted = true));
    await executeStrategy(rule('sourcepoint'), 'essential-only', { perActionTimeoutMs: 50 });
    expect(rejected).toBe(true);
    expect(accepted).toBe(false); // 绝不误点同意
  });

  it('Usercentrics：detect 命中 + data-testid 拒绝按钮', async () => {
    let denied = false;
    document.body.innerHTML =
      '<div id="usercentrics-root"><button data-testid="uc-deny-all-button">Deny</button></div>';
    expect(matchNow(BUILTIN_SNAPSHOT.rules)?.rule.id).toBe('usercentrics');
    document
      .querySelector('[data-testid="uc-deny-all-button"]')!
      .addEventListener('click', () => (denied = true));
    await executeStrategy(rule('usercentrics'), 'essential-only', { perActionTimeoutMs: 50 });
    expect(denied).toBe(true);
  });

  it('TCF 通用兜底：只隐藏不点击（防误点同意）', async () => {
    document.body.innerHTML = '<div class="cmp-banner-xyz">generic consent</div>';
    const r = await executeStrategy(rule('tcf-generic'), 'essential-only', {
      perActionTimeoutMs: 50,
    });
    expect(r.actions.every((a) => a.kind === 'hide')).toBe(true);
  });

  it('具体规则优先于通用兜底（onetrust 在 tcf-generic 之前）', () => {
    document.body.innerHTML = '<div id="onetrust-banner-sdk" class="cmp-banner">x</div>';
    expect(matchNow(BUILTIN_SNAPSHOT.rules)?.rule.id).toBe('onetrust');
  });
});
