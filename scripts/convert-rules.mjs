// Consent-O-Matic 规则 → ClearConsent 内部快照格式的转换脚本。
// 用法: node scripts/convert-rules.mjs <input.json> [--out <file>] [--version <ver>]
//
// 覆盖范围（诚实边界）：C-o-M 的 detectors[].presentMatcher.target.selector（探测器）
// 与简化 methods（REJECT_ALL / HIDE_CMP）。C-o-M 的按类目逐项授权（OPEN_OPTIONS→
// DO_CONSENT→SAVE_CONSENT 的多步 consent 切换）不在覆盖内——此类规则退化为 hide-only
// 兜底并在 stderr 标记，交人工补充。这是 T-021 覆盖率抽测要盯的降级项。

import { readFileSync, writeFileSync } from 'node:fs';

const STRATEGY_KEYS = ['essential-only', 'reject-all-first', 'hide-only'];

function collectSelectors(list, path) {
  return (list ?? [])
    .map((d) => d?.[path[0]]?.[path[1]]?.[path[2]])
    .filter((s) => typeof s === 'string' && s)
    .join(', ');
}

export function convert(comRules, version = new Date().toISOString().slice(0, 10)) {
  const rules = [];
  const warnings = [];
  for (const [id, def] of Object.entries(comRules)) {
    if (id.startsWith('_')) continue; // 跳过 _note 等元字段
    const detect = collectSelectors(def.detectors, ['presentMatcher', 'target', 'selector']);
    if (!detect) {
      warnings.push(`${id}: 无探测器选择器，跳过`);
      continue;
    }
    const methods = def.methods ?? [];
    const reject = methods.find((m) => m.name === 'REJECT_ALL')?.action;
    const hide = methods.find((m) => m.name === 'HIDE_CMP')?.action;
    const hideSel = hide?.target?.selector ?? detect;
    const hideAction = { kind: 'hide', selector: hideSel, label: `隐藏 ${hide?.label ?? id}` };

    let essential;
    if (reject?.target?.selector) {
      const clickAction = {
        kind: 'click',
        selector: reject.target.selector,
        label: `点击「${reject.label ?? '拒绝'}」`,
      };
      essential = [clickAction];
    } else {
      // 无一键拒绝路径（如 TrustArc）→ 退化为隐藏，避免误点同意
      warnings.push(`${id}: 无 REJECT_ALL，拒绝档退化为隐藏`);
      essential = [{ ...hideAction, label: `${hideAction.label}（无拒绝路径）` }];
    }

    rules.push({
      id,
      name: def.name ?? id.charAt(0).toUpperCase() + id.slice(1),
      detect,
      actions: {
        'essential-only': essential,
        'reject-all-first': essential,
        'hide-only': [hideAction],
      },
    });
  }
  return {
    snapshot: { version, source: 'Consent-O-Matic (MIT, cavi-au/Consent-O-Matic) 映射', rules },
    warnings,
  };
}

// 基本结构校验（与 utils/rules-format.ts 的 validateSnapshot 同口径，此处 JS 复刻用于脚本自检）
export function validate(snap) {
  const errs = [];
  if (!Array.isArray(snap.rules)) return ['rules 非数组'];
  const seen = new Set();
  for (const r of snap.rules) {
    if (!r.id || seen.has(r.id)) errs.push(`id 缺失或重复: ${r.id}`);
    seen.add(r.id);
    if (!r.detect) errs.push(`${r.id}: detect 缺失`);
    for (const k of STRATEGY_KEYS) {
      if (!Array.isArray(r.actions?.[k]) || r.actions[k].length === 0)
        errs.push(`${r.id}.actions.${k} 空`);
    }
  }
  return errs;
}

// CLI 入口
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  if (!input) {
    console.error('用法: node scripts/convert-rules.mjs <input.json> [--out <file>]');
    process.exit(1);
  }
  const com = JSON.parse(readFileSync(input, 'utf-8'));
  const { snapshot, warnings } = convert(com);
  const errs = validate(snapshot);
  warnings.forEach((w) => console.error(`⚠ ${w}`));
  if (errs.length) {
    errs.forEach((e) => console.error(`✗ ${e}`));
    process.exit(1);
  }
  console.error(`✓ 转换 ${snapshot.rules.length} 条规则，${warnings.length} 处降级`);
  const json = JSON.stringify(snapshot, null, 2);
  if (outIdx >= 0) writeFileSync(args[outIdx + 1], json);
  else console.log(json);
}
