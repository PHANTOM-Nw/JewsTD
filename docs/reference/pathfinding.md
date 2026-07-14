# 寻路系统

当前实现位于 `src/game/pathfinding/`，采用四方向网格 BFS。

## 路径规则

- 完整路线由调用方提供的起点、`WAYPOINTS` 中的中间必经点和调用方提供的终点组成。
- 相邻两个路线点之间独立寻找最短路径，最后去重连接点并拼接。
- `tower` 和 `obstacle` 格不可通行；起点、终点和空格可通行。
- 任意一段无路可走时，完整寻路返回 `null`。

## 主要接口

- `findPath(grid, start, end)`：计算经过全部必经点的完整路径。
- `canPlaceTower(grid, position, start, end)`：只读验证候选位置是否会堵死路线。
- `getPathLength(path)`：计算路径步数。
- `getMoveDirection(from, to)`：返回相邻路径点之间的移动方向。
- `usePathfinding()`：为 React 游戏引擎绑定当前地图起点和终点。

## 调整地图时

修改 `src/game/config/map.ts` 后，至少检查：必经点未越界、必经点没有落在永久阻塞格、空地图可以找到路线、关键格被阻塞时返回 `null`。目前的手工检查保存在 `src/devtools/pathfindingChecks.ts`，后续应迁移到正式测试框架。
