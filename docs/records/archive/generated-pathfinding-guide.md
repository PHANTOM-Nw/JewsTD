# BFS寻路系统使用指南（Qoder 旧稿）

> 归档说明：本文保留早期设计过程，文件路径和测试方法可能已过期。当前说明请查看 `docs/reference/pathfinding.md`。

## 📋 概述

本系统实现了宝石TD游戏的BFS(广度优先搜索)寻路算法,用于:
- 计算敌人从起点到终点的最短路径
- 验证塔放置是否会堵死路径
- 提供路径相关的辅助功能

## 📁 文件结构

```
src/
├── utils/
│   ├── pathfinding.ts          # BFS寻路核心算法
│   └── pathfinding.test.ts     # 测试用例
├── hooks/
│   └── usePathfinding.ts       # React Hook封装
└── components/
    └── PathfindingTest.tsx     # 测试组件
```

## 🔧 核心功能

### 1. findPath - 寻找最短路径

```typescript
import { findPath } from '../utils/pathfinding'

const path = findPath(grid, startPos, endPos)
// 返回: { row: number; col: number }[] | null
```

**参数:**
- `grid`: 地图网格 (GridCell[][])
- `start`: 起点坐标 {row, col}
- `end`: 终点坐标 {row, col}

**返回值:**
- 成功: 路径点数组(包含起点和终点)
- 失败: null

**示例:**
```typescript
const path = findPath(grid, { row: 0, col: 2 }, { row: 14, col: 17 })
if (path) {
  console.log('路径长度:', path.length - 1, '步')
  console.log('路径点:', path)
}
```

### 2. canPlaceTower - 检查塔放置可行性

```typescript
import { canPlaceTower } from '../utils/pathfinding'

const canPlace = canPlaceTower(grid, position, startPos, endPos)
// 返回: boolean
```

**参数:**
- `grid`: 当前地图网格
- `position`: 要测试的位置 {row, col}
- `startPos`: 起点坐标
- `endPos`: 终点坐标

**返回值:**
- `true`: 可以放置(不会堵死路径)
- `false`: 不能放置(会堵死路径或位置无效)

**示例:**
```typescript
const testPosition = { row: 5, col: 5 }
if (canPlaceTower(grid, testPosition, startPos, endPos)) {
  // 安全放置塔
  grid[testPosition.row][testPosition.col].type = 'tower'
} else {
  console.warn('不能在此位置放置塔,会堵死路径!')
}
```

### 3. getPathLength - 计算路径长度

```typescript
import { getPathLength } from '../utils/pathfinding'

const length = getPathLength(path)
// 返回: number (步数)
```

**示例:**
```typescript
const path = findPath(grid, startPos, endPos)
if (path) {
  const steps = getPathLength(path)
  console.log(`需要走 ${steps} 步`)
}
```

### 4. getMoveDirection - 获取移动方向

```typescript
import { getMoveDirection } from '../utils/pathfinding'

const direction = getMoveDirection(currentPos, nextPos)
// 返回: 'up' | 'down' | 'left' | 'right'
```

**示例:**
```typescript
// 敌人沿路径移动时使用
const currentPos = path[pathIndex]
const nextPos = path[pathIndex + 1]
const direction = getMoveDirection(currentPos, nextPos)
console.log('下一步方向:', direction)
```

### 5. isPositionOnPath - 检查位置是否在路径上

```typescript
import { isPositionOnPath } from '../utils/pathfinding'

const onPath = isPositionOnPath(position, path)
// 返回: boolean
```

**示例:**
```typescript
const path = calculatePath(grid)
const isTargetOnPath = isPositionOnPath({ row: 5, col: 5 }, path)
```

## ⚛️ React Hook 使用

### usePathfinding Hook

```typescript
import { usePathfinding } from '../hooks/usePathfinding'

function GameComponent() {
  const {
    calculatePath,      // 计算路径
    checkPlacement,     // 检查放置可行性
    validatePlacement,  // 验证放置操作
    batchCheckPlacement,// 批量检查
    startPos,           // 起点坐标
    endPos              // 终点坐标
  } = usePathfinding()

  // 使用示例
  const handleMapClick = (row: number, col: number) => {
    // 检查是否可以放置塔
    if (checkPlacement(grid, { row, col })) {
      // 放置塔的逻辑
    }
  }

  // 每帧更新路径
  useEffect(() => {
    const path = calculatePath(grid)
    setCurrentPath(path)
  }, [grid])
}
```

## 🧪 测试方法

### 方法1: 浏览器控制台测试

1. 启动开发服务器: `npm run dev`
2. 打开浏览器访问 http://localhost:5173/
3. 打开开发者工具(F12)
4. 在控制台中运行:

```javascript
// 导入测试模块(需要在vite中配置)
import('./src/utils/pathfinding.test').then(module => {
  // 运行所有测试
  module.runAllTests()
  
  // 或运行单个测试
  module.testBasicPathfinding()
  module.testObstacleBlocking()
  module.testTowerBlocking()
})
```

### 方法2: 可视化测试组件

访问 http://localhost:5173/ 即可看到测试组件界面,点击"重新运行测试"按钮执行基本测试。

### 方法3: 单元测试(推荐)

创建正式的单元测试文件,使用Jest或Vitest:

```typescript
// src/utils/pathfinding.spec.ts
import { describe, it, expect } from 'vitest'
import { findPath, canPlaceTower } from './pathfinding'
import { initializeGrid } from '../config/map'

describe('BFS寻路系统', () => {
  it('应该找到最短路径', () => {
    const grid = initializeGrid()
    const path = findPath(grid, { row: 0, col: 2 }, { row: 14, col: 17 })
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(0)
  })

  it('应该阻止堵死路径的放置', () => {
    // 测试逻辑
  })
})
```

## 🎯 实际应用场景

### 场景1: 游戏初始化时计算初始路径

```typescript
import { usePathfinding } from '../hooks/usePathfinding'
import { initializeGrid } from '../config/map'

function GameInit() {
  const { calculatePath } = usePathfinding()
  const [initialPath, setInitialPath] = useState<{ row: number; col: number }[] | null>(null)

  useEffect(() => {
    const grid = initializeGrid()
    const path = calculatePath(grid)
    setInitialPath(path)
    
    if (!path) {
      console.error('初始地图无法找到路径!')
    }
  }, [])

  return <div>...</div>
}
```

### 场景2: 玩家放置塔时的验证

```typescript
function TowerPlacement({ grid, onPlaceTower }: Props) {
  const { checkPlacement } = usePathfinding()

  const handleClick = (row: number, col: number) => {
    const position = { row, col }
    
    // 检查该位置是否为空
    if (grid[row][col].type !== 'empty') {
      alert('该位置已有建筑!')
      return
    }
    
    // 检查是否会堵死路径
    if (!checkPlacement(grid, position)) {
      alert('不能在此放置塔,会堵死敌人的路径!')
      return
    }
    
    // 安全放置
    onPlaceTower(position)
  }

  return <GameMap onClick={handleClick} />
}
```

### 场景3: 敌人沿路径移动

```typescript
function EnemyMovement({ enemy, path }: Props) {
  const [pathIndex, setPathIndex] = useState(0)

  useEffect(() => {
    if (!path || pathIndex >= path.length - 1) {
      return
    }

    const currentPos = path[pathIndex]
    const nextPos = path[pathIndex + 1]
    const direction = getMoveDirection(currentPos, nextPos)

    // 根据方向移动敌人
    moveEnemy(enemy.id, direction)

    // 到达下一个路径点
    const timer = setTimeout(() => {
      setPathIndex(prev => prev + 1)
    }, enemy.speed)

    return () => clearTimeout(timer)
  }, [pathIndex, path, enemy])

  return <EnemySprite position={path[pathIndex]} />
}
```

### 场景4: 动态路径更新

```typescript
function GameManager() {
  const { calculatePath } = usePathfinding()
  const [currentPath, setCurrentPath] = useState<{ row: number; col: number }[] | null>(null)
  const [grid, setGrid] = useState<GridCell[][]>(initializeGrid())

  // 每次地图变化时重新计算路径
  useEffect(() => {
    const newPath = calculatePath(grid)
    setCurrentPath(newPath)
    
    if (!newPath) {
      // 路径被堵死,游戏结束或其他处理
      handlePathBlocked()
    }
  }, [grid])

  const handlePlaceTower = (position: { row: number; col: number }) => {
    const newGrid = [...grid]
    newGrid[position.row][position.col].type = 'tower'
    setGrid(newGrid)
  }

  return <GameView path={currentPath} onPlaceTower={handlePlaceTower} />
}
```

## ⚡ 性能优化建议

### 1. 避免频繁调用

BFS的时间复杂度是O(rows × cols),在15×20的地图上非常快,但仍应避免不必要的调用:

```typescript
// ❌ 不好: 每帧都计算
useEffect(() => {
  const path = calculatePath(grid)
}, [grid, someOtherState]) // someOtherState变化也会触发

// ✅ 好: 只在grid变化时计算
useEffect(() => {
  const path = calculatePath(grid)
}, [grid])
```

### 2. 使用缓存

如果地图不常变化,可以缓存路径结果:

```typescript
const pathCache = useRef<Map<string, { row: number; col: number }[] | null>>(new Map())

const getCachedPath = (grid: GridCell[][]) => {
  const key = JSON.stringify(grid.map(row => row.map(cell => cell.type)))
  
  if (pathCache.current.has(key)) {
    return pathCache.current.get(key)!
  }
  
  const path = calculatePath(grid)
  pathCache.current.set(key, path)
  return path
}
```

### 3. 批量检查优化

当需要检查多个位置时,使用`batchCheckPlacement`:

```typescript
// ❌ 不好: 多次调用
const results = positions.map(pos => checkPlacement(grid, pos))

// ✅ 好: 批量检查(内部可能有优化空间)
const results = batchCheckPlacement(grid, positions)
```

## 🐛 常见问题

### Q1: 为什么路径找不到?

**可能原因:**
1. 起点或终点被阻挡(类型为'tower'或'obstacle')
2. 路径被塔完全堵死
3. 坐标超出地图边界

**解决方法:**
```typescript
// 检查起点和终点状态
console.log('起点类型:', grid[startPos.row][startPos.col].type)
console.log('终点类型:', grid[endPos.row][endPos.col].type)

// 检查是否有塔阻挡
const path = findPath(grid, startPos, endPos)
if (!path) {
  console.warn('无法找到路径,请检查地图布局')
}
```

### Q2: canPlaceTower会修改grid吗?

**答:** 会临时修改,但会在返回前恢复原状。这是为了测试放置后的效果。

```typescript
// 内部实现:
grid[row][col].type = 'tower'  // 临时标记
const path = findPath(grid, startPos, endPos)
grid[row][col].type = originalType  // 恢复原状
return path !== null
```

### Q3: 如何调试路径?

**方法:**
```typescript
const path = calculatePath(grid)
if (path) {
  console.table(path) // 以表格形式显示
  console.log('路径点数量:', path.length)
  console.log('需要步数:', getPathLength(path))
}
```

## 📊 算法复杂度分析

### 时间复杂度
- **findPath**: O(rows × cols)
  - 每个格子最多访问一次
  - 15×20地图: 最多300次操作,非常快

### 空间复杂度
- **findPath**: O(rows × cols)
  - visited Set: 最多rows × cols个元素
  - queue: 最多rows × cols个元素
  - path数组: 最多rows + cols个元素

### 实际性能
在15×20的地图上:
- 单次findPath调用: < 1ms
- canPlaceTower调用: < 2ms (包含一次findPath)
- 完全可以实时调用

## 🎓 扩展阅读

### BFS算法原理
- BFS保证在无权图中找到最短路径
- 使用队列实现FIFO(先进先出)
- 必须在入队时标记为已访问,避免重复

### 相关改进
- **A*算法**: 如果有启发式信息,可以使用A*获得更好性能
- **双向BFS**: 从起点和终点同时搜索,适合大地图
- **Dijkstra**: 如果格子有不同权重,使用Dijkstra

### 游戏中的应用
- 敌人AI寻路
- 塔防游戏中的路径规划
- RTS单位移动
- 迷宫生成和求解

## 📝 总结

BFS寻路系统是宝石TD游戏的核心功能之一,正确实现后可以:
- ✅ 确保敌人总能找到路径
- ✅ 防止玩家堵死路径导致游戏卡住
- ✅ 提供流畅的游戏体验

关键要点:
1. BFS保证最短路径
2. 放置塔前必须验证
3. 注意边界检查和错误处理
4. 合理使用缓存优化性能

祝开发顺利! 🎮
