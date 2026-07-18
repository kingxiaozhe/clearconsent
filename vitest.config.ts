import { defineConfig } from 'vitest/config';

// 单元测试（纯逻辑）走 Vitest，只扫 tests/unit；扩展集成/E2E 走 Playwright（tests/e2e）。
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
