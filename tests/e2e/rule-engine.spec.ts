// 真实引擎集成：起本地服务器放一个假 CMP 弹窗，验证扩展真能命中并处理（默认策略=仅必要）。
// 这是「业务逻辑端到端行不行」的实证——纯单测证不了 content script 在真实页面上的行为。
import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.resolve(here, '../../.output/chrome-mv3');

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

// 假 OneTrust 弹窗：拒绝按钮点击后写 window.__rejected，容器在页面加载 400ms 后才注入（模拟异步弹窗）
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>fixture</title></head>
<body><h1>host content</h1>
<script>
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.id = 'onetrust-banner-sdk';
    banner.innerHTML = '<button id="onetrust-reject-all-handler">Reject All</button>';
    document.body.appendChild(banner);
    document.getElementById('onetrust-reject-all-handler')
      .addEventListener('click', () => { window.__rejected = true; });
  }, 400);
</script></body></html>`;

let context: BrowserContext;
let swReady: Promise<Worker>;
let server: http.Server;
let baseUrl: string;

// Sourcepoint fixture：无稳定拒绝按钮 → 测兜底隐藏（essential-only 的 hide optional 命中）
const SP_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>sp-fixture</title></head>
<body><h1>host</h1>
<script>
  setTimeout(() => {
    const veil = document.createElement('div'); veil.className = 'sp_veil'; document.body.appendChild(veil);
    const c = document.createElement('div'); c.id = 'sp_message_container_998877';
    c.style.height = '200px'; c.innerHTML = '<p>We value your privacy</p><button title="Accept">Accept</button>';
    document.body.appendChild(c);
  }, 400);
</script></body></html>`;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.url?.startsWith('/sp') ? SP_PAGE : PAGE);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const addr = server.address();
  baseUrl = typeof addr === 'object' && addr ? `http://127.0.0.1:${addr.port}/` : '';

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
  swReady = acquireServiceWorker(context);
});

// N4：SW 在测试间会 idle 停机——复用旧引用做 evaluate 会 "Worker was closed"。
// 需要时用本函数重新获取"活的"SW（已存在/新事件/轮询三路取先到）。
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

/** 唤醒并取活的 SW：先开一个扩展页触发 SW 启动，再取引用。用于 sw.evaluate 前。 */
async function wakeServiceWorker(ctx: BrowserContext, extId: string): Promise<Worker> {
  const ping = await ctx.newPage();
  await ping.goto(`chrome-extension://${extId}/options.html`).catch(() => {});
  const sw = await acquireServiceWorker(ctx);
  await ping.close();
  return sw;
}

test.afterAll(async () => {
  await context?.close();
  await new Promise<void>((r) => server?.close(() => r()));
});

test('默认策略处理假 OneTrust 弹窗：点击拒绝按钮', async () => {
  await swReady; // 确保 SW 就绪
  const page = await context.newPage();
  await page.goto(baseUrl);
  // 弹窗 400ms 后注入，扩展应探测到并点「拒绝全部」→ window.__rejected 变 true
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __rejected?: boolean }).__rejected), {
      timeout: 8000,
    })
    .toBe(true);
  await page.close();
});

test('处理后 SW 写入一条 process-result 日志', async () => {
  const extId = new URL((await swReady).url()).host;
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.waitForTimeout(2000); // 等处理+上报
  // N4：SW 可能已 idle 停机——唤醒并取活引用再 evaluate（否则 "Worker was closed"）
  const sw = await wakeServiceWorker(context, extId);
  const log = await sw.evaluate(async () => {
    const got = await chrome.storage.local.get('log');
    return (got.log as Array<{ site: string; ruleId: string; outcome: string }>) ?? [];
  });
  const hit = log.find((l) => l.ruleId === 'onetrust');
  expect(hit, '应有 onetrust 处理日志').toBeTruthy();
  expect(hit?.outcome).toBe('handled');
  await page.close();
});

test('Sourcepoint 无拒绝按钮时兜底隐藏弹窗（覆盖率缺口补测）', async () => {
  await swReady;
  const page = await context.newPage();
  await page.goto(baseUrl + 'sp');
  // sp_message_container 400ms 后注入；无稳定拒绝按钮 → 扩展 essential-only 走 hide 兜底
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.querySelector<HTMLElement>('[id^="sp_message_container"]');
          return el ? getComputedStyle(el).display : 'absent';
        }),
      { timeout: 8000 },
    )
    .toBe('none'); // 被隐藏
  await page.close();
});
