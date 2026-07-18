// 白名单增删纯逻辑（归一化 + 去重 + 合法性校验），双端共用。可单测。
import { normalizeHost } from './host';

/** 合法 hostname：仅字母数字/点/连字符，含点（域名）或 localhost。挡掉 `https://`、`a/b` 等垃圾（N4）。 */
export function isValidHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h || h.length > 253) return false;
  if (h === 'localhost') return true;
  return /^[a-z0-9.-]+$/.test(h) && h.includes('.') && !h.startsWith('.') && !h.endsWith('.');
}

export function addHost(list: string[], host: string): string[] {
  const h = normalizeHost(host);
  if (!isValidHost(host)) return list; // 非法非空值不入库
  if (list.some((x) => normalizeHost(x) === h)) return list;
  return [...list, h];
}

export function removeHost(list: string[], host: string): string[] {
  const h = normalizeHost(host);
  return list.filter((x) => normalizeHost(x) !== h);
}

export function hasHost(list: string[], host: string): boolean {
  const h = normalizeHost(host);
  return list.some((x) => normalizeHost(x) === h);
}
