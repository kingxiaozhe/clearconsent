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
const PAGE = `<!doctype html><html><body><h1>host</h1><script>
setTimeout(()=>{const b=document.createElement('div');b.id='onetrust-banner-sdk';b.innerHTML='<button id="onetrust-reject-all-handler">Reject</button>';document.body.appendChild(b);b.querySelector('button').addEventListener('click',()=>window.__rejected=true);},400);
</script></body></html>`;
const srv = http.createServer((_q, r) => {
  r.writeHead(200, { 'content-type': 'text/html' });
  r.end(PAGE);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const ctx = await chromium.launchPersistentContext('', {
  executablePath: exe,
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const pg = await ctx.newPage();
pg.on('console', (m) => console.log('[page]', m.type(), m.text().slice(0, 120)));
pg.on('pageerror', (e) => console.log('[pageerr]', String(e).slice(0, 120)));
await pg.goto(url);
await pg.waitForTimeout(6000);
const state = await pg.evaluate(() => ({
  rejected: window.__rejected,
  bannerDisplay: document.querySelector('#onetrust-banner-sdk')
    ? getComputedStyle(document.querySelector('#onetrust-banner-sdk')).display
    : 'absent',
}));
console.log('结果:', JSON.stringify(state));
const log = await sw
  .evaluate(async () => {
    const g = await chrome.storage.local.get(['log', 'rules-meta']);
    return {
      logLen: (g.log || []).length,
      entries: (g.log || []).map((l) => l.ruleId + ':' + l.outcome),
    };
  })
  .catch((e) => 'SW closed: ' + String(e).slice(0, 40));
console.log('SW log:', JSON.stringify(log));
await ctx.close();
srv.close();
