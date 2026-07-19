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
// N4（T-005 补审）：跨架构/CI 兼容——试 mac-arm64/mac-x64/linux 三种布局，且按版本号降序选最新缓存。
function resolveExecutable(): string | undefined {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  const layouts = [
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    'chrome-linux/chrome',
  ];
  const dirs = fs
    .readdirSync(cache)
    .filter((d) => d.startsWith('chromium-'))
    .sort((a, b) => Number(b.split('-')[1] || 0) - Number(a.split('-')[1] || 0)); // 版本降序,选最新
  for (const dir of dirs) {
    for (const layout of layouts) {
      const p = path.join(cache, dir, layout);
      if (fs.existsSync(p)) return p;
    }
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
    // 新无头模式（--headless=new）支持 MV3 扩展且在无显示器/CI 环境稳定；
    // 旧 headless:false 依赖真实显示，在无头 shell 里会退化 flaky（实测根因）。
    headless: true,
    args: [
      '--headless=new',
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });
  // 立刻同步挂 waitForEvent 捕获 SW 引用（worker.url() 在停止后仍可用）。
  // N4（T-005 补审）：残留竞态——若 SW 在 launch 返回前就注册并 idle 停机，serviceWorkers()
  // 为空且 waitForEvent 也等不到新事件。故 race：已存在 / 新事件 / 轮询已注册（含停机的）三者取先到。
  swReady = acquireServiceWorker(context);
});

function acquireServiceWorker(ctx: BrowserContext): Promise<Worker> {
  const now = ctx.serviceWorkers();
  if (now[0]) return Promise.resolve(now[0]);
  const byEvent = ctx.waitForEvent('serviceworker');
  const byPoll = (async () => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const [sw] = ctx.serviceWorkers();
      if (sw) return sw;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('poll timeout');
  })();
  return Promise.race([byEvent, byPoll]);
}

test.afterAll(async () => {
  await context?.close();
});

test('service worker 注册且 manifest 名称正确', async () => {
  const sw = await swReady;
  expect(sw.url()).toContain('background.js');
  expect(new URL(sw.url()).host).toMatch(/^[a-z]{32}$/);
  // N4（T-005 补审）：标题声称"名称正确"须真断言——读被加载的构建产物 manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT_PATH, 'manifest.json'), 'utf-8'));
  expect(manifest.name).toBe('ClearConsent');
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
