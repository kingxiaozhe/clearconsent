// service worker（MV3）：会随时休眠——状态一律经 utils/storage，不留内存。
// 消息处理器在顶层同步注册（休眠唤醒只重放顶层注册）。
// T-010 契约冻结点：process-result / get-site-state / set-site-enabled 三消息在此定稿，
// F2/F3 依赖此冻结版——之后改契约 = 变更立项。
import {
  appendLog,
  ensureSchema,
  getLog,
  getSettings,
  getSiteDisabled,
  getWhitelist,
  setSiteDisabled,
} from '@/utils/storage';
import { registerHandlers } from '@/utils/messaging';
import { computeSiteState } from '@/utils/site-state';
import { normalizeHost } from '@/utils/host';

export default defineBackground(() => {
  // 顶层同步注册（休眠唤醒只重放顶层注册）。
  registerHandlers({
    // content 上报一次处理结果 → 写本地日志（环形队列，storage 层保证串行不丢）
    'process-result': async (payload) => {
      await appendLog(payload);
      return { ok: true };
    },

    // popup/content 查站点状态（本站开关/白名单/最近一条收据）
    'get-site-state': async ({ site }) => {
      const [settings, whitelist, siteDisabled, log] = await Promise.all([
        getSettings(),
        getWhitelist(),
        getSiteDisabled(),
        getLog(),
      ]);
      return computeSiteState({ site, settings, whitelist, siteDisabled, log });
    },

    // popup/options 切本站开关 → 落 siteDisabled，广播给该站已注入的 content（即时生效）
    'set-site-enabled': async ({ site, enabled }) => {
      const host = normalizeHost(site);
      const disabled = await getSiteDisabled();
      const has = disabled.some((h) => normalizeHost(h) === host);
      if (enabled && has) {
        await setSiteDisabled(disabled.filter((h) => normalizeHost(h) !== host));
      } else if (!enabled && !has) {
        await setSiteDisabled([...disabled, host]);
      }
      // 广播（content 侧监听 site-enabled-changed，实时刷新——F3 消费）
      chrome.runtime
        .sendMessage({ type: 'site-enabled-changed', payload: { site: host, enabled } })
        .catch(() => {
          /* 无接收端时静默 */
        });
      return { ok: true, site: host, enabled };
    },
  });

  // schema 初始化放 onInstalled（MV3 标准初始化位，安装/更新即唤醒 SW 执行）。
  chrome.runtime.onInstalled.addListener(() => {
    ensureSchema().catch((e) => console.error('[ClearConsent] ensureSchema', e));
  });
  // SW 冷启动也补一次（幂等），保证读数据前 schema 就绪。
  ensureSchema().catch((e) => console.error('[ClearConsent] ensureSchema', e));
});
