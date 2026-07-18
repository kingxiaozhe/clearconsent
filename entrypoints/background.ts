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
  updateSiteDisabled,
} from '@/utils/storage';
import { registerHandlers } from '@/utils/messaging';
import { computeSiteState } from '@/utils/site-state';
import { normalizeHost } from '@/utils/host';
import { checkForUpdate } from '@/utils/rules-fetcher';

const UPDATE_ALARM = 'rules-update';

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
      // 原子读改写（N4）：并发切开关不互相覆盖
      await updateSiteDisabled((disabled) => {
        const has = disabled.some((h) => normalizeHost(h) === host);
        if (enabled && has) return disabled.filter((h) => normalizeHost(h) !== host);
        if (!enabled && !has) return [...disabled, host];
        return disabled;
      });
      // 落 storage 后，content script 经 chrome.storage.onChanged 原生收到变更并重探——
      // N4：SW 的 runtime.sendMessage 到不了 content script，故不在此广播，靠 storage 事件传播。
      return { ok: true, site: host, enabled };
    },

    // options「立即检查更新」入口（F4 T-018/T-020）
    'check-rules-update': async () => ({ updated: await checkForUpdate() }),
  });

  // 规则库定时更新（F4）。alarms 权限见 wxt.config（PRD 豁免项）。
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === UPDATE_ALARM) checkForUpdate().catch(() => {});
  });
  // N4③：只在 alarm 不存在时创建——每次 SW 冷启动重建会重置 24h 周期,频繁唤醒会饿死更新。
  chrome.alarms.get(UPDATE_ALARM).then((existing) => {
    if (!existing) chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 24 * 60 });
  });
  // N4③：冷启动兜底——距上次检查超 24h 则补拉一次（alarm 因浏览器重启等错过时的保险）。
  getRulesMeta().then((m) => {
    if (Date.now() - (m.lastCheckAt ?? 0) > 24 * 60 * 60 * 1000) checkForUpdate().catch(() => {});
  });

  // schema 初始化放 onInstalled（MV3 标准初始化位，安装/更新即唤醒 SW 执行）。
  chrome.runtime.onInstalled.addListener(() => {
    ensureSchema()
      .then(() => checkForUpdate()) // 安装后补拉一次规则库
      .catch((e) => console.error('[ClearConsent] onInstalled', e));
  });
  // SW 冷启动也补一次（幂等），保证读数据前 schema 就绪。
  ensureSchema().catch((e) => console.error('[ClearConsent] ensureSchema', e));
});
