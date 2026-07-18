// 规则快照格式（纯数据，CWS 红线：不含任何可执行代码）。
// 内置快照随包分发，F4 可用同格式的远程快照覆盖（storage 优先）。

import type { ActionKind, Strategy } from './types';

/** 单个动作：点击某选择器，或隐藏某选择器。 */
export interface RuleAction {
  kind: ActionKind; // 'hide' | 'click'
  selector: string;
  label: string; // 人类可读，进收据/日志
  optional?: boolean; // 选择器不存在时静默跳过（多步序列中的非关键步）
}

/** 一条 CMP 规则。detect 命中即认为该 CMP 出现在页面。 */
export interface CmpRule {
  id: string;
  name: string;
  /** 探测选择器：页面上存在即匹配此 CMP */
  detect: string;
  /** 每档策略的动作序列 */
  actions: Record<Strategy, RuleAction[]>;
  /** 应用的 host（后缀匹配，如 'example.com'）；空/缺省=全局通用规则 */
  hosts?: string[];
}

export interface RuleSnapshot {
  version: string; // 如 '2026.07.18'
  source: string; // 署名，如 'Consent-O-Matic (MIT) + 手工补充'
  rules: CmpRule[];
}

export const STRATEGY_KEYS: Strategy[] = ['essential-only', 'reject-all-first', 'hide-only'];

/** 结构校验：F4 远程快照落库前的唯一闸也复用此函数（T-019）。返回错误列表，空=合法。 */
export function validateSnapshot(data: unknown): string[] {
  const errs: string[] = [];
  if (typeof data !== 'object' || data === null) return ['根节点非对象'];
  const snap = data as Partial<RuleSnapshot>;
  if (typeof snap.version !== 'string') errs.push('version 缺失或非字符串');
  if (typeof snap.source !== 'string') errs.push('source 缺失或非字符串');
  if (!Array.isArray(snap.rules)) return [...errs, 'rules 非数组'];
  const seen = new Set<string>();
  snap.rules.forEach((r, i) => {
    const p = `rules[${i}]`;
    if (!r || typeof r !== 'object') return errs.push(`${p} 非对象`);
    if (typeof r.id !== 'string' || !r.id) errs.push(`${p}.id 缺失`);
    else if (seen.has(r.id)) errs.push(`${p}.id 重复: ${r.id}`);
    else seen.add(r.id);
    if (typeof r.detect !== 'string' || !r.detect) errs.push(`${p}.detect 缺失`);
    for (const k of STRATEGY_KEYS) {
      const acts = r.actions?.[k];
      if (!Array.isArray(acts)) {
        errs.push(`${p}.actions.${k} 非数组`);
        continue;
      }
      acts.forEach((a, j) => {
        if (a.kind !== 'hide' && a.kind !== 'click') errs.push(`${p}.actions.${k}[${j}].kind 非法`);
        if (typeof a.selector !== 'string' || !a.selector)
          errs.push(`${p}.actions.${k}[${j}].selector 缺失`);
        // 纯数据红线：动作里不允许出现函数/脚本字段
        for (const key of Object.keys(a)) {
          if (!['kind', 'selector', 'label', 'optional'].includes(key))
            errs.push(`${p}.actions.${k}[${j}] 含非法字段 ${key}（纯数据红线）`);
        }
      });
    }
  });
  return errs;
}
