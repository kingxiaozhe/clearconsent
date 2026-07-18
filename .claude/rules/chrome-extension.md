---
description: 扩展铁律——权限、MV3 约束、消息契约、透明性
globs: 'entrypoints/**, wxt.config.ts'
---

# 浏览器扩展规范

## 项目形态（已定，变更过人工确认）

- 脚手架: WXT；manifest 源头: `wxt.config.ts`（禁止改 .output 产物）
- 表面: popup / options / content script；目标: 仅 Chrome/Edge

## 权限（最大红线）

- 基线 `storage + scripting + host *://*/*`；**新增权限=契约变更**，单独提交并附用途理由（alarms 仅允许在 4.rules-pipeline 引入，理由已在 PRD 豁免表）
- 禁止 eval / new Function / 远程可执行代码；**规则更新只传 JSON 数据**（CWS 红线）

## service worker

- 会随时休眠：跨事件状态一律 `chrome.storage`（session/local），禁止内存驻留
- 监听器顶层同步注册；定时用 `chrome.alarms`（F4 起）

## content script

- isolated world；注入 UI 必须 shadow DOM；初始化幂等（SPA 路由变化会重复触发）
- 对宿主页 DOM 的选择器全部来自规则库数据，禁止散落硬编码
- 失败静默：任何异常不得破坏宿主页（F1 AC 红线）

## 消息与存储

- 消息契约（`process-result` / `get-site-state` / `set-site-enabled`）以 1.rule-engine/design.md 为准，T-010 冻结后改契约=变更立项
- 收发统一走 `utils/messaging`（T-004 建），禁止裸调 chrome.runtime.sendMessage
- storage schema 带版本位（T-004），变更必须附迁移

## 透明性（产品红线）

- 每次处理动作必须完整写入本地日志（收据的数据源）；**0 条数据离开本机**——出现任何网络上报代码即违反产品立身之本（规则拉取除外，且只进不出）
