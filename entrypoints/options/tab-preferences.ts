// 偏好 tab（F3 T-015）：应答策略三选一 + 全局暂停。写 settings，content 经 storage.onChanged 即时生效。
import { getSettings, updateSettings } from '@/utils/storage';
import { STRATEGIES, type Strategy } from '@/utils/types';
import type { OptionsTab } from './tabs';

const DESC: Record<Strategy, { title: string; sub: string }> = {
  'essential-only': {
    title: '仅必要 Cookie',
    sub: '弹窗提供选择时，仅同意站点运行所必需的 Cookie，其余拒绝。（推荐）',
  },
  'reject-all-first': {
    title: '全部拒绝优先',
    sub: '尽可能拒绝所有用途；无法拒绝时回退「仅必要」。',
  },
  'hide-only': {
    title: '只隐藏不应答',
    sub: '不与弹窗交互，仅将其从页面移除。站点会视你为「未做选择」。',
  },
};

export const preferencesTab: OptionsTab = {
  id: 'preferences',
  label: '处理偏好',
  async render(c) {
    const settings = await getSettings();
    c.innerHTML = `
      <h2>处理偏好</h2>
      <p class="hint">遇到 cookie 弹窗时，ClearConsent 以哪种方式替你应答。所有动作都会记入透明日志。</p>
      <div id="prefs">
        ${STRATEGIES.map(
          (s) => `
          <label class="pref ${settings.strategy === s ? 'active' : ''}">
            <input type="radio" name="strategy" value="${s}" ${settings.strategy === s ? 'checked' : ''} />
            <b>${DESC[s].title}</b>${s === 'essential-only' ? ' <span class="tag">推荐</span>' : ''}
            <small>${DESC[s].sub}</small>
          </label>`,
        ).join('')}
      </div>
      <hr class="sep" />
      <label class="row global">
        <span><b>全局暂停</b><small>暂停期间所有站点不处理、不记日志。</small></span>
        <input type="checkbox" id="global-toggle" ${settings.globalEnabled ? '' : 'checked'} />
      </label>`;

    c.querySelectorAll<HTMLInputElement>('input[name="strategy"]').forEach((r) =>
      r.addEventListener('change', async () => {
        await updateSettings((cur) => ({ ...cur, strategy: r.value as Strategy })); // 原子（N4）
        this.render(c);
      }),
    );
    c.querySelector<HTMLInputElement>('#global-toggle')?.addEventListener('change', async (e) => {
      const paused = (e.target as HTMLInputElement).checked;
      await updateSettings((cur) => ({ ...cur, globalEnabled: !paused }));
    });
  },
};
