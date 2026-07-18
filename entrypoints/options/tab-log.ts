// 透明日志 tab（F2 T-012/T-013）：日志表 + 站点筛选 + 导出 JSON（纯前端，零网络）。
import { getLog, clearLog } from '@/utils/storage';
import { logTableHtml } from '@/utils/receipt-view';
import type { OptionsTab } from './tabs';
import type { ProcessResult } from '@/utils/types';

function download(rows: ProcessResult[]): void {
  // 纯本地 Blob 下载，零网络请求（透明性红线：日志不出网）
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clearconsent-log-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const logTab: OptionsTab = {
  id: 'log',
  label: '透明日志',
  async render(c) {
    const rows = await getLog();
    const sites = [...new Set(rows.map((r) => r.site))].sort();
    c.innerHTML = `
      <h2>透明日志</h2>
      <p class="hint">扩展替你做的每一次处理都记在这里，仅存本机，可导出，从不上传。</p>
      <div class="toolbar">
        <select id="site-filter">
          <option value="">全部站点</option>
          ${sites.map((s) => `<option value="${s}">${s}</option>`).join('')}
        </select>
        <button id="export-btn" class="btn">导出 JSON</button>
        <button id="clear-btn" class="btn btn--ghost">清空</button>
      </div>
      <div id="log-body">${logTableHtml(rows, null)}</div>`;

    const body = c.querySelector<HTMLElement>('#log-body')!;
    c.querySelector<HTMLSelectElement>('#site-filter')?.addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value || null;
      body.innerHTML = logTableHtml(rows, v);
    });
    c.querySelector('#export-btn')?.addEventListener('click', () => download(rows));
    c.querySelector('#clear-btn')?.addEventListener('click', async () => {
      await clearLog();
      this.render(c);
    });
  },
};
