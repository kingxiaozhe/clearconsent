import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ClearConsent',
    description: '自动处理网站 cookie 同意弹窗，并以可审计的收据展示替你做了什么',
    // 权限基线（PRD）：storage + scripting + alarms（F4 T-018 引入，规则库定时更新，PRD 豁免项）
    // 用途理由（提审文案）：alarms 仅用于每 24h 拉取规则库 JSON 数据，不触及任何用户数据。
    permissions: ['storage', 'scripting', 'alarms'],
    host_permissions: ['*://*/*'],
  },
});
