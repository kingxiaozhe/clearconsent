// 执行器：按策略对页面执行动作序列。红线（槽点 #2）——绝不误伤宿主页：
// 只操作规则声明的选择器、hide 后成对恢复滚动锁、任何异常静默不冒泡。

import type { ProcessAction, ProcessOutcome, Strategy } from './types';
import type { CmpRule, RuleAction } from './rules-format';

export interface ExecResult {
  outcome: ProcessOutcome;
  actions: ProcessAction[]; // 实际执行成功的动作（进收据/日志）
  strategyUsed: Strategy; // 可能因回退与请求不同
}

export interface ExecOptions {
  root?: Document;
  perActionTimeoutMs?: number; // 单个动作等选择器出现的上限，默认 1000
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 轮询等选择器出现（按钮常晚于容器几十毫秒）。非法选择器直接返回 null，不抛。 */
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
      return null; // 坏选择器
    }
    if (el) return el;
    if (Date.now() >= deadline) return null;
    await sleep(50);
  }
}

/** 执行单个动作，成功返回其 ProcessAction 记录，跳过/失败返回 null。 */
async function runAction(
  action: RuleAction,
  root: Document,
  timeoutMs: number,
): Promise<ProcessAction | null> {
  const el = await waitFor(root, action.selector, action.optional ? 0 : timeoutMs);
  if (!el) return null; // 缺失：optional 静默、required 记为未命中（上层判回退）
  if (action.kind === 'click') {
    (el as HTMLElement).click();
  } else {
    (el as HTMLElement).style.setProperty('display', 'none', 'important');
  }
  return { kind: action.kind, selector: action.selector, label: action.label };
}

/** hide 后恢复被 CMP 锁死的滚动（成对恢复，防隐藏横幅却留下 scroll-lock 白页）。 */
function restoreScroll(doc: Document): void {
  for (const el of [doc.body, doc.documentElement]) {
    if (!el) continue;
    if (el.style.overflow === 'hidden') el.style.overflow = '';
    if (el.style.position === 'fixed') el.style.position = '';
  }
}

async function runSequence(
  actions: RuleAction[],
  root: Document,
  timeoutMs: number,
): Promise<{ done: ProcessAction[]; hadHide: boolean; clickHit: boolean }> {
  const done: ProcessAction[] = [];
  let hadHide = false;
  let clickHit = false;
  for (const a of actions) {
    const rec = await runAction(a, root, timeoutMs);
    if (rec) {
      done.push(rec);
      if (rec.kind === 'hide') hadHide = true;
      if (rec.kind === 'click') clickHit = true;
    }
  }
  return { done, hadHide, clickHit };
}

/**
 * 按策略执行。reject-all-first 无拒绝路径（零点击命中）时回退 essential-only。
 * 全程 try 包裹——任何异常静默，返回 failed，绝不冒泡到宿主页。
 */
export async function executeStrategy(
  rule: CmpRule,
  strategy: Strategy,
  opts: ExecOptions = {},
): Promise<ExecResult> {
  const { root = document, perActionTimeoutMs = 1000 } = opts;
  try {
    let used: Strategy = strategy;
    let { done, hadHide, clickHit } = await runSequence(
      rule.actions[strategy],
      root,
      perActionTimeoutMs,
    );

    // 全部拒绝优先：本档需要点击但零命中 → 回退仅必要
    if (
      strategy === 'reject-all-first' &&
      !clickHit &&
      rule.actions['reject-all-first'].some((a) => a.kind === 'click')
    ) {
      const fb = await runSequence(rule.actions['essential-only'], root, perActionTimeoutMs);
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
