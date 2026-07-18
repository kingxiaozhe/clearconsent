// 消息通信封装。收发统一走此层，禁止裸调 chrome.runtime.sendMessage。
// 契约 = specs/1.rule-engine/design.md；T-010 冻结后改动 = 变更立项。

import type { ProcessResult, SiteState } from './types';

interface MessageMap {
  'process-result': { payload: ProcessResult; response: { ok: boolean } };
  'get-site-state': { payload: { site: string }; response: SiteState };
  'set-site-enabled': {
    payload: { site: string; enabled: boolean };
    response: { ok: boolean; site: string; enabled: boolean };
  };
}

export type MessageType = keyof MessageMap;

export interface Message<T extends MessageType = MessageType> {
  type: T;
  payload: MessageMap[T]['payload'];
}

/** 发送方（content/popup/options）。Promise 风格，全项目统一。 */
export async function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageMap[T]['payload'],
): Promise<MessageMap[T]['response']> {
  return chrome.runtime.sendMessage({ type, payload } satisfies Message<T>);
}

/** SW 侧注册处理器。返回 Promise 的 handler 会被正确 await 并回传响应。 */
export function registerHandlers(handlers: {
  [T in MessageType]?: (
    payload: MessageMap[T]['payload'],
    sender: chrome.runtime.MessageSender,
  ) => Promise<MessageMap[T]['response']> | MessageMap[T]['response'];
}): void {
  chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
    const handler = handlers[msg.type];
    if (!handler) return false;
    // 异步响应统一 Promise.resolve + return true（Chrome 要求）
    Promise.resolve(handler(msg.payload as never, sender))
      .then(sendResponse)
      .catch((err) => {
        console.error(`[ClearConsent] handler ${msg.type} failed`, err);
        sendResponse(undefined as never);
      });
    return true;
  });
}
