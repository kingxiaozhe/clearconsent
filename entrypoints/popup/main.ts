// popup 收据界面（F2 T-011）。V3 纸白设计还原：衬线大状态词锚点 + 等宽处理收据。
// popup 失焦即销毁——只读状态（get-site-state），长任务不放这里。
import './style.css';
import { sendMessage } from '@/utils/messaging';
import { getLog, getRulesMeta } from '@/utils/storage';
import { normalizeHost } from '@/utils/host';
import { badgeHtml, deriveState, receiptHtml, summarize, summaryHtml } from '@/utils/receipt-view';
import type { SiteState } from '@/utils/types';

const BADGE_LABEL = {
  handled: '已处理',
  paused: '已暂停',
  whitelisted: '信任站点',
  untouched: '未处理',
} as const;

async function currentSite(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? normalizeHost(new URL(tab.url).hostname) : '';
}

async function render() {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;
  const site = await currentSite();
  if (!site) {
    app.innerHTML = `<div class="pad"><p class="receipt-empty">当前页面不适用。</p></div>`;
    return;
  }
  const state: SiteState = (await sendMessage('get-site-state', { site })) ?? {
    site,
    enabled: false,
    whitelisted: false,
    lastResult: null,
  };
  const badge = deriveState(state);
  const [log, rulesMeta] = await Promise.all([getLog(), getRulesMeta()]);
  const week = summarize(log, Date.now());

  app.innerHTML = `
    <header class="hd">
      <span class="wordmark">ClearConsent<span class="dot">.</span></span>
      ${badgeHtml(badge)}
    </header>
    <div class="pad">
      <div class="site">当前站点 ${site}</div>
      <div class="status-word">${BADGE_LABEL[badge]}</div>
      ${receiptHtml(badge, state.lastResult)}
      ${summaryHtml(week)}
    </div>
    <div class="controls">
      <label class="row">
        <span>在本站启用</span>
        <input type="checkbox" id="site-toggle" ${
          state.enabled && !state.whitelisted ? 'checked' : ''
        } />
      </label>
      <button id="options-btn" class="link">设置与透明日志</button>
    </div>
    <footer class="ft">零数据收集 · 无支付集成 · 开源 · 规则库 ${rulesMeta.version}</footer>
  `;

  document
    .querySelector<HTMLInputElement>('#site-toggle')
    ?.addEventListener('change', async (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      await sendMessage('set-site-enabled', { site, enabled });
      render();
    });
  document.querySelector('#options-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

render();
