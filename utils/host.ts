// hostname 归一化。双端（content/popup/options）共用，白名单/本站开关比对一致性靠它。
// T-015 会复用本函数——集中一处，避免"www. 前缀算不算同站"各写各的。

export function normalizeHost(input: string): string {
  let h = input.trim().toLowerCase();
  try {
    if (h.includes('://')) h = new URL(h).hostname;
  } catch {
    /* 非完整 URL，按裸 hostname 处理 */
  }
  return h.replace(/^www\./, '');
}

/** 去 query 的完整 URL，避免把敏感查询参数写进日志（透明性红线）。 */
export function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url.split('?')[0];
  }
}
