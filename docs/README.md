# 项目文档

本目录区分“当前有效文档”和“历史记录”。开发前优先阅读当前文档，遇到设计来源或历史问题时再查归档。

## 当前文档

- `product/gameplay.md`：当前已实现玩法与一局游戏的流程。
- `product/composite.md`：当前已实现的花色差异、面子合成、中发白和墙体互动规则。
- `product/麻将TD核心流程方案_v0.2.md`：基础进牌与隐藏信息方案；后续机制以 `gameplay.md`、`composite.md` 和源码为准。
- `product/original-reference.md`：经典宝石 TD 调研材料，只提供设计灵感，不代表当前实现。
- `architecture/overview.md`：模块边界、状态流和技术债。
- `reference/game-configuration.md`：配置文件入口与修改检查表。
- `reference/pathfinding.md`：当前多段 BFS 规则和接口。
- `development/conventions.md`：目录、代码、文档和提交约定。
- `development/deployment.md`：`main` 分支到阿里云静态站点的自动部署与权限配置。
- `records/README.md`：记录命名和维护方式。

## 历史归档

`records/archive/` 保存 Qoder 生成的实现总结、修复报告和旧版说明。这些文件可能包含过期路径或数值，不应作为当前开发依据，也不要求随代码同步更新。

## 事实来源优先级

1. 可执行源码和类型。
2. `architecture/`、`product/`、`reference/` 下的当前文档。
3. `records/` 下的当次变更记录。
4. `records/archive/` 下的历史材料。

仓库中的旧宝石类型、配置、素材和兼容组件不是当前玩家规则。除非任务明确要求，不应根据这些遗留代码恢复宝石品质或特殊宝石玩法。
