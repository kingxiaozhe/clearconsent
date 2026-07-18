# ClearConsent（工作名）

自动处理网站 cookie 同意弹窗的 Chrome 扩展（MV3），差异化 = **透明**：用户能清楚看到「它替你做了什么」。重写自被弃养的 [I don't care about cookies](https://chromewebstore.google.com/detail/i-dont-care-about-cookies/fihnjjcciajhdojfnbdddfaoknhalnja)。

## 是什么

- 遇到 cookie 弹窗自动应答（默认「仅必要 Cookie」，可切「全部拒绝优先」/「只隐藏」）
- 每次处理生成一张**可审计的收据**：隐藏了什么、点了什么、0 条数据离开本机
- 零数据收集、零支付集成、开源（MIT）——与商业化竞品反着来

## 架构

- **脚手架**：WXT + TypeScript，无 UI 框架（原生 TS + 模板渲染）
- **表面**：content script（全站注入处理弹窗）+ popup（收据）+ options（偏好/信任站点/透明日志/规则库）
- **权限**：`storage` + `scripting` + `alarms` + host `*://*/*`（3+1，比 IDCAC 的 7+1 干净；每项理由见提审清单）
- **规则库**：内置 7 大 CMP 快照（OneTrust/Quantcast/Cookiebot/Didomi/Osano/CookieYes/TrustArc），参照 Consent-O-Matic（MIT）结构映射，见 `scripts/NOTICE-rules.md`；F4 支持从 GitHub Raw 定时更新（纯 JSON 数据，经安全闸校验）

```text
utils/        引擎核心（纯逻辑，可单测）
├── rules-format / builtin-rules   规则格式+安全校验闸+内置快照
├── matcher / executor             CMP 探测 + 三策略执行(误伤宿主页全防护)
├── content-core / site-state      content 编排(幂等/跳过) + 状态计算
├── storage / messaging            串行写队列 + 冻结的消息契约
├── receipt-view / whitelist       收据渲染 + 白名单逻辑
└── rules-update / rules-fetcher   版本比对+远程校验 + 拉取落库
entrypoints/  三入口装配（background SW / content / popup / options tab 外壳）
```

## 常用命令

- `npm run dev` 开发 · `npm run build` 构建 · `npm run zip` 打包
- `npm test` 单测（91）· `npm run test:e2e` 真实浏览器 E2E（5，含假 CMP 端到端处理）
- `npm run screenshot` 截 popup/options 真实界面
- `npm run typecheck` / `npm run lint`

## 质量

91 单元测试 + 5 E2E（3 冒烟 + 2 真实引擎集成）。每个任务经 Codex 双模型对抗审查，累计拦下 30+ 处真实问题（多为「误伤宿主页」「远程规则安全」类）。

## 隐私承诺

处理记录只存本机 `chrome.storage.local`，可导出，从不上传。规则库拉取只访问固定 GitHub Raw、不带任何用户数据。无遥测、无第三方追踪。
