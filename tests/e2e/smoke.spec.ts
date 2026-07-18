// 形态确认技术前提（0.bootstrap T-005）：把构建产物以解包扩展形式加载进真实 Chrome，
// 冒烟"能加载 / service worker 注册 / popup 可开"。扩展的"能跑"只有真实浏览器能证。
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(here, '../../.output/chrome-mv3');

let context: BrowserContext;

test.beforeAll(async () => {
  expect(fs.existsSync(path.join(EXT_PATH, 'manifest.json')), '需先 npm run build 生成产物').toBe(
    true,
  );
  context = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    headless: false,
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });
});

test.afterAll(async () => {
  await context?.close();
});

async function getServiceWorker(ctx: BrowserContext) {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 10_000 });
  return sw;
}

test('service worker 注册且 manifest 名称正确', async () => {
  const sw = await getServiceWorker(context);
  expect(sw.url()).toContain('background.js');
  const id = new URL(sw.url()).host;
  expect(id).toMatch(/^[a-z]{32}$/);
});

test('popup 能打开并渲染 ClearConsent', async () => {
  const sw = await getServiceWorker(context);
  const extId = new URL(sw.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await expect(page.locator('#app')).toContainText('ClearConsent');
  await page.close();
});

test('options 页能打开', async () => {
  const sw = await getServiceWorker(context);
  const extId = new URL(sw.url()).host;
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/options.html`);
  await expect(page.locator('#app')).toContainText('ClearConsent 设置');
  await page.close();
});
