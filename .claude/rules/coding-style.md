---
description: TS 编码风格
---
# 编码风格
- 严格 TS（tsconfig 继承 WXT 默认），公共函数显式返回类型
- 命名: 文件 kebab-case，类型 PascalCase，常量 UPPER_SNAKE
- 入口薄、逻辑下沉 utils/：entrypoints/* 只做装配
- 注释只写约束与陷阱（如 SW 休眠语义），不复述代码
