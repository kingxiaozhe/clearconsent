// 白名单增删纯逻辑（归一化 + 去重），双端共用。可单测。
import { normalizeHost } from './host';

export function addHost(list: string[], host: string): string[] {
  const h = normalizeHost(host);
  if (!h) return list;
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
