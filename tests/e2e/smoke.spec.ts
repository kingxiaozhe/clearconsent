// 形态确认技术前提（0.bootstrap T-005）：把构建产物以解包扩展形式加载进真实 Chrome，
// 冒烟"能加载 / service worker 注册 / popup 可开"。扩展的"能跑"只有真实浏览器能证。
import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(here, '../../.output/chrome-mv3');

// 扩展只能在 Chrome for Testing 里加载——系统 Chrome（2026 版）默认屏蔽 --load-extension，
// 扩展静默不加载（SW 永不注册）。优先用 playwright 缓存的 CfT 二进制。
function resolveExecutable(): string | undefined {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  for (const dir of fs.readdirSync(cache).filter((d) => d.startsWith('chromium-'))) {
    const cft = path.join(
      cache,
      dir,
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    );
    if (fs.existsSync(cft)) return cft;
  }
  return undefined;
}

let context: BrowserContext;
let swReady: Promise<Worker>; // 在 launch 后立即捕获，避免 SW 注册后 idle 停止导致错过

test.beforeAll(async () => {
  expect(fs.existsSync(path.join(EXT_PATH, 'manifest.json')), '需先 npm run build 生成产物').toBe(
    true,
  );
  const executablePath = resolveExecutable();
  context = await chromium.launchPersistentContext('', {
    ...(executablePath ? { executablePath } : { channel: 'chromium' }),
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });
  // 同步挂 waitForEvent：SW 从 onInstalled 注册后可能很快 idle 停止，事后 serviceWorkers()
  // 会为空；这里立刻捕获引用（worker.url() 在停止后仍可用），彻底避开竞态。
  const existing = context.serviceWorkers();
  swReady = existing[0] ? Promise.resolve(existing[0]) : context.waitForEvent('serviceworker');
});

test.afterAll(async () => {
  await context?.close();
});

test('service worker 注册且 manifest 名称正确', async () => {
  const sw = await swReady;
  expect(sw.url()).toContain('background.js');
  expect(new URL(sw.url()).host).toMatch(/^[a-z]{32}$/);
});

test('popup 能打开并渲染品牌头', async () => {
  const extId = new URL((await swReady).url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/popup.html`);
  // 品牌字标始终渲染（无活动标签的兜底分支也保留头部）
  await expect(page.locator('.wordmark')).toContainText('ClearConsent');
  await page.close();
});

test('options 页能打开并渲染 tab 外壳', async () => {
  const extId = new URL((await swReady).url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/options.html`);
  await expect(page.locator('.brand')).toContainText('ClearConsent');
  await expect(page.locator('.nav')).toContainText('处理偏好'); // 首个 tab 渲染
  await page.close();
});
