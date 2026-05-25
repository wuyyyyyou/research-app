# Domain Docs

本仓库使用 single-context 的领域文档布局。工程类 skill 在探索代码前，应按本文件说明读取领域上下文和架构决策。

## 探索前先读取

- 仓库根目录的 `CONTEXT.md`
- 与当前改动区域相关的 `docs/adr/` 架构决策记录

如果这些文件或目录不存在，静默继续即可。不要因为缺失就主动建议创建；生产类 skill 会在术语或决策真正明确后按需创建。

## 文件结构

Single-context 仓库的预期结构：

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-example-decision.md
└── src/
```

## 使用 glossary 的词汇

当输出中需要命名领域概念时，例如 issue 标题、重构建议、问题假设或测试名，优先使用 `CONTEXT.md` 中定义的术语。不要使用 glossary 明确要求避免的同义词。

如果需要的概念还没有出现在 glossary 中，这是一个信号：要么当前表述不是项目已有语言，需要重新考虑；要么确实存在术语缺口，可以留给 `/grill-with-docs` 后续澄清。

## 标出 ADR 冲突

如果输出内容和已有 ADR 冲突，需要明确指出冲突，而不是静默覆盖。
