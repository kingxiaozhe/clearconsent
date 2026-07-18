import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ClearConsent',
    description: '自动处理网站 cookie 同意弹窗，并以可审计的收据展示替你做了什么',
    // 权限基线（PRD）：3+1，alarms 由 4.rules-pipeline 的 T-018 引入
    permissions: ['storage', 'scripting'],
    host_permissions: ['*://*/*'],
  },
});
