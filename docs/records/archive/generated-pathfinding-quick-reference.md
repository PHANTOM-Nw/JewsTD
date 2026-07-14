# BFS寻路系统 - 快速参考（Qoder 旧稿）

> 归档说明：本文仅用于追溯，当前接口与目录请以源码和 `docs/reference/pathfinding.md` 为准。

## 📦 导入方式

```typescript
// 核心算法
import { 
  findPath,           // BFS寻路
  canPlaceTower,      // 检查塔放置
  getPathLength,      // 计算路径长度
  getMoveDirection,   // 获取移动方向
  isPositionOnPath    // 检查位置是否在路径上
} from '../utils/pathfinding'

// React Hook
import { usePathfinding } from '../hooks/usePathfinding'
```

## 🎯 常用API

### 1. 计算路径
```typescript
const path = findPath(grid, startPos, endPos)
// 返回: { row: number; col: number }[] | null
```

### 2. 检查放置
```typescript
const canPlace = canPlaceTower(grid, position, startPos, endPos)
// 返回: boolean
```

### 3. 使用Hook
```typescript
const { calculatePath, checkPlacement, startPos, endPos } = usePathfinding()
const path = calculatePath(grid)
const canPlace = checkPlacement(grid, { row: 5, col: 5 })
```

## 🔑 关键参数

### GridCell类型
```typescript
interface GridCell {
  row: number
  col: number
  type: 'empty' | 'tower' | 'obstacle' | 'mine' | 'start' | 'end'
  towerId?: string
}
```

### 坐标格式
```typescript
{ row: number, col: number }
// 例如: { row: 0, col: 2 }
```

## ⚡ 性能指标

- **findPath**: < 1ms (15×20地图)
- **canPlaceTower**: < 2ms
- **时间复杂度**: O(rows × cols)
- **空间复杂度**: O(rows × cols)

## 🧪 快速测试

```bash
# 启动开发服务器
npm run dev

# 访问 http://localhost:5173/
# 在浏览器控制台运行:
import('./src/utils/pathfinding.test').then(m => m.runAllTests())
```

## 💡 最佳实践

### ✅ 推荐做法
```typescript
// 1. 使用Hook获取功能
const { calculatePath, checkPlacement } = usePathfinding()

// 2. 只在grid变化时重新计算
useEffect(() => {
  const path = calculatePath(grid)
}, [grid])

// 3. 放置前验证
if (checkPlacement(grid, position)) {
  placeTower(position)
}
```

### ❌ 避免做法
```typescript
// 1. 不要每帧都计算路径
// 2. 不要忘记检查返回值是否为null
// 3. 不要在循环中频繁调用canPlaceTower
```

## 🐛 常见问题

### Q: 路径返回null?
**A:** 检查起点/终点是否被阻挡,或路径被完全堵死

### Q: canPlaceTower会修改grid吗?
**A:** 会临时修改但会自动恢复,不影响游戏状态

### Q: 如何优化性能?
**A:** 使用缓存,避免不必要的重复计算

## 📚 详细文档

查看 `BFS_PATHFINDING_GUIDE.md` 获取完整文档和示例

## 🎮 实际应用场景

### 场景1: 初始化路径
```typescript
useEffect(() => {
  const grid = initializeGrid()
  const path = calculatePath(grid)
  setInitialPath(path)
}, [])
```

### 场景2: 放置验证
```typescript
const handlePlace = (pos) => {
  if (checkPlacement(grid, pos)) {
    // 安全放置
  } else {
    alert('会堵死路径!')
  }
}
```

### 场景3: 敌人移动
```typescript
const direction = getMoveDirection(
  path[pathIndex], 
  path[pathIndex + 1]
)
```

---

**提示**: 将此文件加入书签,方便快速查阅! 🔖
