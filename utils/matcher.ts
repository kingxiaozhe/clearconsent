// CMP 探测（content 侧）。弹窗常异步注入，故先即时查一次，再用 MutationObserver 观察
// 直到某规则的 detect 选择器命中或超时。matchNow 是纯函数便于单测；detectCmp 是 DOM 包装。

import type { CmpRule } from './rules-format';

export interface Match {
  rule: CmpRule;
  element: Element;
}

/** 即时匹配：返回首个 detect 选择器在 root 内命中的规则。纯查询，jsdom 可测。 */
export function matchNow(rules: CmpRule[], root: ParentNode = document): Match | null {
  for (const rule of rules) {
    let el: Element | null = null;
    try {
      el = root.querySelector(rule.detect);
    } catch {
      // 非法选择器不应打断整轮匹配（远程规则可能带坏选择器）
      continue;
    }
    if (el) return { rule, element: el };
  }
  return null;
}

export interface DetectOptions {
  timeoutMs?: number; // 观察上限，默认 4000
  root?: Document;
}

/**
 * 异步探测：立即查一次；未命中则观察 DOM 变化，命中即 resolve，超时 resolve null。
 * 观察器与定时器在结束时成对清理，不泄漏。
 */
export function detectCmp(rules: CmpRule[], opts: DetectOptions = {}): Promise<Match | null> {
  const { timeoutMs = 4000, root = document } = opts;
  const immediate = matchNow(rules, root);
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let done = false;
    const finish = (m: Match | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(m);
    };
    const observer = new MutationObserver(() => {
      const m = matchNow(rules, root);
      if (m) finish(m);
    });
    // 观察 document 节点本身（而非 documentElement）——某些框架会替换整个 <html>，
    // 绑 documentElement 会在换根后失聪，绑 document 覆盖换根（N4 拦截）。
    observer.observe(root, { childList: true, subtree: true });
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}
