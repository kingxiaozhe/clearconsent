// 规则更新纯逻辑（可单测）：版本比对 + 远程包完整性校验。拉取/落库副作用在 background。
import { validateSnapshot, type RuleSnapshot } from './rules-format';

export interface RemoteManifest {
  version: string;
  siteCount: number;
  publishedAt: number;
  byteLength: number;
}

export const MAX_RULES_BYTES = 2 * 1024 * 1024; // 2MB 上限

/** 点分数字版本比对：a 高于 b 返回 >0。'2026.07.18' / '1.2.3' 都支持。 */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function shouldUpdate(localVersion: string, remoteVersion: string): boolean {
  return compareVersion(remoteVersion, localVersion) > 0;
}

/** manifest 结构校验。返回错误列表，空=合法。 */
export function validateManifest(data: unknown): string[] {
  const e: string[] = [];
  if (typeof data !== 'object' || data === null) return ['manifest 非对象'];
  const m = data as Partial<RemoteManifest>;
  if (typeof m.version !== 'string' || !m.version) e.push('version 缺失');
  if (typeof m.byteLength !== 'number' || m.byteLength <= 0) e.push('byteLength 非法');
  else if (m.byteLength > MAX_RULES_BYTES) e.push(`byteLength 超上限(${MAX_RULES_BYTES})`);
  if (typeof m.siteCount !== 'number') e.push('siteCount 非法');
  return e;
}

/**
 * 校验拉取到的 rules 原文：① 声明字节数与实际一致且不超上限 ② 复用 T-006 安全闸
 * validateSnapshot（纯数据红线：拒绝任何代码形态字段）。返回 {snapshot} 或 {errors}。
 */
export function validateRemoteRules(
  rawText: string,
  manifest: RemoteManifest,
): { snapshot: RuleSnapshot } | { errors: string[] } {
  const actualBytes = new TextEncoder().encode(rawText).length;
  if (actualBytes !== manifest.byteLength)
    return { errors: [`字节数不符: 声明 ${manifest.byteLength} 实际 ${actualBytes}`] };
  if (actualBytes > MAX_RULES_BYTES) return { errors: ['超字节上限'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { errors: ['JSON 解析失败'] };
  }
  const errs = validateSnapshot(parsed);
  if (errs.length) return { errors: errs };
  return { snapshot: parsed as RuleSnapshot };
}
