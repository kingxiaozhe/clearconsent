// content script：isolated world，全站注入。装配 matcher + executor + 上报。
// 幂等/跳过逻辑在 utils/content-core（可单测）；此处只做 DOM/消息接线与 SPA 路由监听。
import { sendMessage } from '@/utils/messaging';
import { loadSnapshot, filterByHost } from '@/utils/rules-loader';
import { detectCmp } from '@/utils/matcher';
import { executeStrategy } from '@/utils/executor';
import { getSettings } from '@/utils/storage';
import { runOnce, type ContentDeps } from '@/utils/content-core';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  async main() {
    const site = location.hostname;
    const processed = new Set<string>();

    const deps: ContentDeps = {
      site,
      now: () => Date.now(),
      href: () => location.href,
      getState: async () => {
        const state = await sendMessage('get-site-state', { site });
        // SW 未就绪时保守跳过（宁可不处理，不误动）
        return state ?? { site, enabled: false, whitelisted: false, lastResult: null };
      },
      getStrategy: async () => (await getSettings()).strategy,
      getRules: async () => filterByHost((await loadSnapshot()).rules, site),
      detect: (rules) => detectCmp(rules),
      execute: (rule, strategy) => executeStrategy(rule, strategy),
      report: async (result) => {
        await sendMessage('process-result', result);
      },
    };

    const tick = () => runOnce(deps, processed).catch(() => {});

    // 首轮
    await tick();

    // SPA 路由监听：URL 变化后再探一轮（新页面可能有新 CMP；已处理的靠幂等键跳过）
    let lastHref = location.href;
    const onNav = () => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      tick();
    };
    window.addEventListener('popstate', onNav);
    // history.pushState/replaceState 不触发事件，用轻量轮询兜底（SPA 常用 pushState）
    setInterval(onNav, 1000);

    // 本站开关实时切换：SW 广播 site-enabled-changed 时重探（F3 消费）
    chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type === 'site-enabled-changed') tick();
    });
  },
});
