# 项目文档

本目录区分“当前有效文档”和“历史记录”。开发前优先阅读当前文档，遇到设计来源或历史问题时再查归档。

## 当前文档

- `product/gameplay.md`：当前已实现玩法与一局游戏的流程。
- `product/original-reference.md`：经典宝石 TD 调研材料，只提供设计灵感，不代表当前实现。
- `architecture/overview.md`：模块边界、状态流和技术债。
- `reference/game-configuration.md`：配置文件入口与修改检查表。
- `reference/pathfinding.md`：当前多段 BFS 规则和接口。
- `development/conventions.md`：目录、代码、文档和提交约定。
- `records/README.md`：记录命名和维护方式。

## 历史归档

`records/archive/` 保存 Qoder 生成的实现总结、修复报告和旧版说明。这些文件可能包含过期路径或数值，不应作为当前开发依据，也不要求随代码同步更新。

## 事实来源优先级

1. 可执行源码和类型。
2. `architecture/`、`product/`、`reference/` 下的当前文档。
3. `records/` 下的当次变更记录。
4. `records/archive/` 下的历史材料。
