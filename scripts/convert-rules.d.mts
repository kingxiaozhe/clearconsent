import type { RuleSnapshot } from '../utils/rules-format';

export function convert(
  comRules: Record<string, unknown>,
  version?: string,
): { snapshot: RuleSnapshot; warnings: string[] };

export function validate(snap: RuleSnapshot): string[];
