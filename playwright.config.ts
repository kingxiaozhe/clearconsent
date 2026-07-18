import { defineConfig } from '@playwright/test';

// 扩展 E2E：测试内用 launchPersistentContext 手动加载构建产物，故此处不配 projects browser。
// 本地用系统 Chrome（channel: 'chrome'）——扩展只能在真实 Chromium 系浏览器里验证。
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
});
