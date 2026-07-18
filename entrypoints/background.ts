// service worker（MV3）：会随时休眠——状态一律经 utils/storage，不留内存。
// 消息处理器在顶层同步注册（休眠唤醒只重放顶层注册）。
import { ensureSchema } from '@/utils/storage';
import { registerHandlers } from '@/utils/messaging';

export default defineBackground(() => {
  // schema 初始化（首装/升级补默认值）。副作用，不阻塞监听器注册。
  ensureSchema().catch((e) => console.error('[ClearConsent] ensureSchema', e));

  // 业务处理器由 F1/F3 填充（process-result / get-site-state / set-site-enabled）。
  // 底座只建立注册通道，保证契约入口存在。
  registerHandlers({});
});
