// 形态确认/UI 截图工具：把构建产物加载进 Chrome for Testing，截 popup/options 真实界面。
// 用法: node scripts/screenshot-extension.mjs [popup|options|all] [--out <dir>]
// 常驻工具（N6 形态确认复用）——不再每次现搭。系统 Chrome 2026 版屏蔽 --load-extension,必用 CfT。
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(here, '../.output/chrome-mv3');
const args = process.argv.slice(2);
const which = args.find((a) => !a.startsWith('--')) ?? 'all';
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.resolve(here, '../.output/screenshots');

function resolveCft() {
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(cache)) return undefined;
  for (const d of fs.readdirSync(cache).filter((x) => x.startsWith('chromium-'))) {
    const p = path.join(
      cache,
      d,
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    );
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error('缺构建产物，先 npm run build');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const ctx = await chromium.launchPersistentContext('', {
  executablePath: resolveCft(),
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const existing = ctx.serviceWorkers();
const sw = existing[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(sw.url()).host;

const targets =
  which === 'all'
    ? [
        ['popup', 380, 600],
        ['options', 1000, 720],
      ]
    : [[which, which === 'popup' ? 380 : 1000, which === 'popup' ? 600 : 720]];

for (const [name, w, h] of targets) {
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: w, height: h });
  await pg.goto(`chrome-extension://${id}/${name}.html`);
  await pg.waitForTimeout(400);
  const out = path.join(outDir, `${name}.png`);
  await pg.screenshot({ path: out });
  console.log(`✓ ${name} → ${out}`);
  await pg.close();
}
console.log(`扩展 id: ${id}`);
await ctx.close();
