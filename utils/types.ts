// 全项目共享类型。契约以 specs/1.rule-engine/design.md 为准，T-010 冻结后改动 = 变更立项。

export type Strategy = 'essential-only' | 'reject-all-first' | 'hide-only';

export const STRATEGIES: Strategy[] = ['essential-only', 'reject-all-first', 'hide-only'];
export const DEFAULT_STRATEGY: Strategy = 'essential-only';

export type ActionKind = 'hide' | 'click';

export interface ProcessAction {
  kind: ActionKind;
  selector: string;
  label: string;
}

export type ProcessOutcome = 'handled' | 'skipped' | 'failed';

/** content → SW 上报的一次处理结果，也是收据/日志的数据单元 */
export interface ProcessResult {
  site: string;
  url: string;
  strategy: Strategy;
  actions: ProcessAction[];
  durationMs: number;
  outcome: ProcessOutcome;
  ruleId: string;
  ts: number;
}

export interface SiteState {
  site: string;
  enabled: boolean;
  whitelisted: boolean;
  lastResult: ProcessResult | null;
}

export interface Settings {
  strategy: Strategy;
  globalEnabled: boolean;
}

export interface RulesMeta {
  version: string;
  siteCount: number;
  source: 'builtin' | 'remote';
  updatedAt: number;
  lastCheckAt?: number;
  lastCheckError?: string | null;
}
