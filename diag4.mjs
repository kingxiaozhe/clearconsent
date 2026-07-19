import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
const EXT = path.resolve('.output/chrome-mv3');
const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
let exe;
for (const d of fs.readdirSync(cache).filter((x) => x.startsWith('chromium-'))) {
  const p = path.join(
    cache,
    d,
    'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  );
  if (fs.existsSync(p)) {
    exe = p;
    break;
  }
}
const PAGE = `<!doctype html><html><body><h1>host</h1><script>setTimeout(()=>{const b=document.createElement('div');b.id='onetrust-banner-sdk';b.innerHTML='<button id="onetrust-reject-all-handler">R</button>';document.body.appendChild(b);b.querySelector('button').addEventListener('click',()=>window.__rejected=true);},400);</script></body></html>`;
const srv = http.createServer((_q, r) => {
  r.writeHead(200, { 'content-type': 'text/html' });
  r.end(PAGE);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const ctx = await chromium.launchPersistentContext('', {
  executablePath: exe,
  headless: true,
  args: ['--headless=new', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
// 直接问 SW: get-site-state 响应吗 + rules-meta(看 checkForUpdate 有没有搞坏)
const swState = await sw
  .evaluate(async () => {
    const meta = (await chrome.storage.local.get('rules-meta'))['rules-meta'];
    return { meta };
  })
  .catch((e) => 'SWerr:' + String(e).slice(0, 60));
console.log('SW meta:', JSON.stringify(swState));
const pg = await ctx.newPage();
const errs = [];
pg.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 100));
});
await pg.goto(url);
await pg.waitForTimeout(5500);
const r = await pg.evaluate(() => ({
  rej: window.__rejected || false,
  disp: document.querySelector('#onetrust-banner-sdk')?.style.display || '?',
}));
console.log('页面:', JSON.stringify(r), 'console错误:', errs.slice(0, 3));
const log = await sw
  .evaluate(async () =>
    ((await chrome.storage.local.get('log')).log || []).map((l) => l.ruleId + ':' + l.outcome),
  )
  .catch((e) => 'SWclosed');
console.log('SW log:', JSON.stringify(log));
await ctx.close();
srv.close();
process.exit(0);
