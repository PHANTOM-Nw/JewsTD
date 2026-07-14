# 记录约定

`records/` 用于记录一次具体变更的背景、发现、决定、验证和后续事项，帮助后续维护者理解“为什么这样做”。

## 文件命名

使用 `YYYY-MM-DD-topic.md`，topic 使用简短英文 kebab-case，例如：

```text
2026-07-14-project-initialization.md
2026-08-02-wave-balance-review.md
```

## 建议结构

```markdown
# 标题

## 背景
## 发现
## 决定与变更
## 验证
## 后续事项
```

记录应引用当前文件路径，不粘贴大段源码。已经失效但仍有追溯价值的生成报告移入 `archive/`，并在顶部注明“归档”。
