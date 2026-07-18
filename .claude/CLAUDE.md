# ClearConsent（工作名）

自动处理网站 cookie 同意弹窗的 Chrome 扩展（MV3），差异化=透明收据：用户可审计「它替你做了什么」。重写自 IDCAC（规格见 ../idcac-rewrite-specs/）。

## 技术栈

- 语言: TypeScript
- 框架: 无 UI 框架（原生 TS + 轻量模板渲染）
- 扩展脚手架: WXT（约定式 entrypoints，manifest 由 wxt.config.ts 生成）
- 包管理: npm
- 版本控制: local（git，无 remote）
- 交付形态: Chrome 扩展 (MV3) · popup + options + content script · 仅 Chrome/Edge
- 业务地图: 跳过(小项目,0→1 起步)

## 常用命令

- 开发运行: `npm run dev`
- 构建: `npm run build`（产物 .output/chrome-mv3/）
- 类型检查: `npm run compile`
- 打包发布: `npm run zip`

## 目录结构

```text
entrypoints/   # WXT 约定入口: background.ts / content.ts / popup/ (options/ 待建)
components/    # 共享 UI 片段
public/        # 静态资源(图标)
wxt.config.ts  # manifest 唯一源头——权限改动只许改这里
```

## 规则

@rules/coding-style.md
@rules/chrome-extension.md
@rules/testing.md
@rules/security.md
@rules/git-workflow.md
