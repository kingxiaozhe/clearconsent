// content 编排核心（可注入依赖，便于单测幂等与跳过逻辑）。
// DOM 实际探测/执行由 matcher/executor 完成，本模块只管「何时处理、处理什么、不重复处理」。

import type { ProcessResult, SiteState, Strategy } from './types';
import type { CmpRule } from './rules-format';
import type { Match } from './matcher';
import type { ExecResult } from './executor';
import { shouldProcess } from './site-state';
import { stripQuery } from './host';

export interface ContentDeps {
  getState: () => Promise<SiteState>;
  getStrategy: () => Promise<Strategy>;
  getRules: () => Promise<CmpRule[]>;
  detect: (rules: CmpRule[]) => Promise<Match | null>;
  execute: (rule: CmpRule, strategy: Strategy) => Promise<ExecResult>;
  report: (result: ProcessResult) => Promise<boolean>; // 返回是否上报成功（N4：失败要释放幂等键重试）
  now: () => number;
  href: () => string;
  site: string;
}

/** 幂等键：站点 + 规则 id。同一 CMP 不因 SPA 路由变化重复处理（AC-104）。 */
export function idempotencyKey(site: string, ruleId: string): string {
  return `${site}::${ruleId}`;
}

/**
 * 处理一轮：跳过判断 → 探测 → 执行 → 上报。已处理过的 (站点+规则) 直接跳过。
 * 返回本轮是否真正处理了一个新 CMP（供路由监听决定是否继续观察）。
 */
export async function runOnce(deps: ContentDeps, processed: Set<string>): Promise<boolean> {
  const state = await deps.getState();
  if (!shouldProcess(state)) return false; // 白名单/停用/全局暂停 → 零操作零日志（AC-106）

  // N4②：探测前先排除已处理规则——否则残留的旧 CMP（已隐藏但仍在 DOM）会一直被首匹配命中，
  // 遮住页面上后出现的新 CMP。过滤后 detect 只在未处理规则里找。
  const rules = (await deps.getRules()).filter(
    (r) => !processed.has(idempotencyKey(deps.site, r.id)),
  );
  if (rules.length === 0) return false;

  const match = await deps.detect(rules);
  if (!match) return false;

  // N4③：detect 可能等待数秒，其间用户可能停用/加白——执行前再查一次状态
  const state2 = await deps.getState();
  if (!shouldProcess(state2)) return false;

  const key = idempotencyKey(deps.site, match.rule.id);
  processed.add(key);

  const strategy = await deps.getStrategy();
  const started = deps.now();
  const result = await deps.execute(match.rule, strategy);
  // skipped（选择器全未命中）不占幂等：允许后续重试
  if (result.outcome === 'skipped') {
    processed.delete(key);
    return false;
  }

  const record: ProcessResult = {
    site: deps.site,
    url: stripQuery(deps.href()),
    strategy: result.strategyUsed,
    actions: result.actions,
    durationMs: deps.now() - started,
    outcome: result.outcome,
    ruleId: match.rule.id,
    ts: deps.now(),
  };
  // N4④：上报失败（SW 未就绪/异常）释放幂等键，让下一轮重试，避免永久漏收据
  const reported = await deps.report(record);
  if (!reported) {
    processed.delete(key);
    return false;
  }
  return result.outcome === 'handled';
}
