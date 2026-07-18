// service worker（MV3）：会随时休眠——状态一律经 utils/storage，不留内存。
// 消息处理器在顶层同步注册（休眠唤醒只重放顶层注册）。
import { ensureSchema } from '@/utils/storage';
import { registerHandlers } from '@/utils/messaging';

export default defineBackground(() => {
  // 消息处理器顶层同步注册——SW 休眠唤醒时只重放顶层注册。
  // 业务处理器由 F1/F3 填充（process-result / get-site-state / set-site-enabled）；
  // 底座只建立注册通道，保证契约入口存在。
  registerHandlers({});

  // schema 初始化放 onInstalled（MV3 标准初始化位，安装/更新即唤醒 SW 执行）。
  chrome.runtime.onInstalled.addListener(() => {
    ensureSchema().catch((e) => console.error('[ClearConsent] ensureSchema', e));
  });

  // SW 冷启动也补一次（幂等：schemaVersion 命中即返回），保证读数据前 schema 就绪。
  ensureSchema().catch((e) => console.error('[ClearConsent] ensureSchema', e));
});
