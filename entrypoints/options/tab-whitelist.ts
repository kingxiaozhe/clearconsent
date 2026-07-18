// 信任站点 tab（F3 T-015/T-016）：列表 + 添加 + 删除。写 whitelist，content 经 storage.onChanged 即时生效。
import { getWhitelist, updateWhitelist } from '@/utils/storage';
// getWhitelist 用于初始渲染读取；增删走 updateWhitelist 原子操作
import { addHost, removeHost } from '@/utils/whitelist';
import type { OptionsTab } from './tabs';

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export const whitelistTab: OptionsTab = {
  id: 'whitelist',
  label: '信任站点',
  async render(c) {
    const list = await getWhitelist();
    c.innerHTML = `
      <h2>信任站点</h2>
      <p class="hint">这些站点上，ClearConsent 完全不介入（弹窗按原样显示）。</p>
      <div class="toolbar">
        <input type="text" id="wl-input" placeholder="输入域名，如 example.com" class="txt" />
        <button id="wl-add" class="btn">添加</button>
      </div>
      <div id="wl-body">
        ${
          list.length === 0
            ? `<p class="receipt-empty">暂无信任站点。</p>`
            : `<table class="log"><tbody>${list
                .map(
                  (h) =>
                    `<tr><td>${esc(h)}</td><td class="right"><button class="link del" data-host="${esc(h)}">移除</button></td></tr>`,
                )
                .join('')}</tbody></table>`
        }
      </div>`;

    const input = c.querySelector<HTMLInputElement>('#wl-input')!;
    const add = async () => {
      const val = input.value;
      await updateWhitelist((cur) => addHost(cur, val)); // 原子读改写（N4）
      input.value = '';
      this.render(c);
    };
    c.querySelector('#wl-add')?.addEventListener('click', add);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') add();
    });
    c.querySelectorAll<HTMLButtonElement>('.del').forEach((b) =>
      b.addEventListener('click', async () => {
        await updateWhitelist((cur) => removeHost(cur, b.dataset.host!));
        this.render(c);
      }),
    );
  },
};
