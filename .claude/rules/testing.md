---
description: 测试约定
---

# 测试规范

- 单测: Vitest（T-005 起引入），chrome.\* 统一 mock 层放 tests/mocks/，禁止各测各 mock
- E2E: Playwright launchPersistentContext + --load-extension 加载 .output/chrome-mv3（T-005 基座）；扩展行为断言以 E2E 为准
- QA 新补测试须变异自证（种 1-2 处行为变异必须变红）
- 覆盖率不设硬指标，红线=消息契约与执行器三策略必须有测试
