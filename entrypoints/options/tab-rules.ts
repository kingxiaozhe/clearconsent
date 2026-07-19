// 规则库 tab（F4 T-020）：版本/站点数/来源/最近检查 + 「立即检查」 + 关于（隐私承诺）。
import { getRulesMeta } from '@/utils/storage';
import { sendMessage } from '@/utils/messaging';
import type { OptionsTab } from './tabs';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export const rulesTab: OptionsTab = {
  id: 'rules',
  label: '规则库与关于',
  async render(c) {
    const m = await getRulesMeta();
    const last = m.lastCheckAt
      ? new Date(m.lastCheckAt).toLocaleString('zh-CN', { hour12: false })
      : '从未';
    c.innerHTML = `
      <h2>规则库</h2>
      <div class="card-stat">
        <div><span class="muted">版本</span><b>${esc(m.version)}</b></div>
        <div><span class="muted">覆盖站点</span><b>${m.siteCount}</b></div>
        <div><span class="muted">来源</span><b>${m.source === 'remote' ? '在线更新' : '内置'}</b></div>
        <div><span class="muted">最近检查</span><b>${esc(last)}</b></div>
      </div>
      ${m.lastCheckError ? `<p class="hint">当前使用内置规则库（暂未连接在线更新源，不影响使用）。</p>` : ''}
      <button id="check-btn" class="btn">立即检查更新</button>
      <span id="check-status" class="muted"></span>
      <hr class="sep" />
      <h2>关于</h2>
      <ul class="about">
        <li>零数据收集——你的浏览与处理记录只存本机，从不上传。</li>
        <li>无支付集成、无第三方追踪。</li>
        <li>开源（MIT）。规则库参照 Consent-O-Matic（MIT）结构映射，见 NOTICE。</li>
      </ul>`;

    const status = c.querySelector<HTMLElement>('#check-status')!;
    c.querySelector('#check-btn')?.addEventListener('click', async () => {
      status.textContent = '检查中…';
      const res = await sendMessage('check-rules-update', {});
      status.textContent = res?.updated ? '已更新到最新规则库。' : '已是最新（或暂时无法连接）。';
      if (res?.updated) this.render(c);
    });
  },
};
