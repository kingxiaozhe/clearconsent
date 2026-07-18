// 执行器：按策略对页面执行动作序列。红线（槽点 #2）——绝不误伤宿主页：
// 只操作规则声明的选择器、拒绝隐藏整页、不碰宿主自己的滚动锁、任何异常静默不冒泡。

import type { ProcessAction, ProcessOutcome, Strategy } from './types';
import type { CmpRule, RuleAction } from './rules-format';

export interface ExecResult {
  outcome: ProcessOutcome;
  actions: ProcessAction[]; // 实际执行成功的动作（进收据/日志）
  strategyUsed: Strategy; // 可能因回退与请求不同
}

export interface ExecOptions {
  root?: Document;
  perActionTimeoutMs?: number; // 单动作等选择器出现上限，默认 800
  totalBudgetMs?: number; // 整个序列总预算，默认 2500（守护项 3「快」：多动作等待不无限累加）
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 轮询等选择器出现（按钮常晚于容器）。坏选择器直接返回 null，不抛。 */
async function waitFor(
  root: ParentNode,
  selector: string,
  timeoutMs: number,
): Promise<Element | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let el: Element | null = null;
    try {
      el = root.querySelector(selector);
    } catch {
      return null;
    }
    if (el) return el;
    if (Date.now() >= deadline) return null;
    await sleep(50);
  }
}

function isDisabled(el: Element): boolean {
  return (
    (el as HTMLButtonElement).disabled === true ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.hasAttribute('disabled')
  );
}

/** 执行单个动作。成功返回记录，跳过/失败返回 null。 */
async function runAction(
  action: RuleAction,
  root: Document,
  timeoutMs: number,
): Promise<ProcessAction | null> {
  const el = await waitFor(root, action.selector, timeoutMs);
  if (!el) return null;
  if (action.kind === 'click') {
    // N4：禁用/无效按钮 click() 无效果，却会被误记为成功而阻断回退——视为未命中
    if (isDisabled(el)) return null;
    (el as HTMLElement).click();
  } else {
    // N4：拒绝隐藏整页元素（规则若误写 html/body，隐藏=整站白屏）
    const tag = el.tagName?.toLowerCase();
    if (tag === 'html' || tag === 'body') return null;
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  }
  return { kind: action.kind, selector: action.selector, label: action.label };
}

/**
 * 恢复被 CMP 锁死的滚动。N4：只清 body 的**内联** overflow:hidden，绝不动 position:fixed
 * 或 documentElement——那些更可能是宿主自己的登录/支付弹窗锁，误清会解锁宿主模态。
 * 残留风险（宿主恰好也用 body 内联 overflow:hidden）记 LESSONS，待后续按 CMP 归因细化。
 */
function restoreScroll(doc: Document): void {
  const body = doc.body;
  if (body && body.style.overflow === 'hidden') body.style.overflow = '';
}

async function runSequence(
  actions: RuleAction[],
  root: Document,
  perActionTimeoutMs: number,
  deadline: number,
): Promise<{ done: ProcessAction[]; hadHide: boolean }> {
  const done: ProcessAction[] = [];
  let hadHide = false;
  for (const a of actions) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break; // N4：总预算耗尽，不再串行累加等待
    const to = a.optional ? 0 : Math.min(perActionTimeoutMs, remaining);
    const rec = await runAction(a, root, to);
    if (rec) {
      done.push(rec);
      if (rec.kind === 'hide') hadHide = true;
    }
  }
  return { done, hadHide };
}

/**
 * 按策略执行。reject-all-first **完全无所作为**（零动作命中）时才回退 essential-only——
 * N4：旧版按「无点击」回退会在已隐藏后覆盖记录、漏恢复滚动、策略漂移。
 * 全程 try 包裹，任何异常静默返回 failed，绝不冒泡到宿主页。
 */
export async function executeStrategy(
  rule: CmpRule,
  strategy: Strategy,
  opts: ExecOptions = {},
): Promise<ExecResult> {
  const { root = document, perActionTimeoutMs = 800, totalBudgetMs = 2500 } = opts;
  const deadline = Date.now() + totalBudgetMs;
  try {
    let used: Strategy = strategy;
    let { done, hadHide } = await runSequence(
      rule.actions[strategy],
      root,
      perActionTimeoutMs,
      deadline,
    );

    const essentialDiffers =
      JSON.stringify(rule.actions['essential-only']) !==
      JSON.stringify(rule.actions['reject-all-first']);
    if (strategy === 'reject-all-first' && done.length === 0 && essentialDiffers) {
      const fb = await runSequence(
        rule.actions['essential-only'],
        root,
        perActionTimeoutMs,
        deadline,
      );
      if (fb.done.length > 0) {
        used = 'essential-only';
        done = fb.done;
        hadHide = fb.hadHide;
      }
    }

    if (hadHide) restoreScroll(root);
    return { outcome: done.length > 0 ? 'handled' : 'skipped', actions: done, strategyUsed: used };
  } catch {
    return { outcome: 'failed', actions: [], strategyUsed: strategy };
  }
}
