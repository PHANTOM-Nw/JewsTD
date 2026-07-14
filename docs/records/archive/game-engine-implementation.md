# 宝石TD游戏引擎实现总结

## 📁 新增文件

### 1. `src/utils/collision.ts`
碰撞检测工具函数,提供:
- `checkCircleCollision()` - 圆形碰撞检测
- `getDistance()` - 计算两点距离

### 2. `src/hooks/useGameEngine.ts` (核心文件,784行)
完整的游戏引擎Hook,整合所有系统

### 3. `src/components/GameEngineTest.tsx`
测试组件,用于验证引擎功能

---

## 🎯 核心架构设计

### 状态管理策略

**UI状态 (useState)** - 触发重渲染
```typescript
{
  wood: number,           // 木材
  gold: number,           // 金币
  mineHealth: number,     // 矿坑生命
  wave: number,           // 波次
  gameStatus: string,     // 游戏状态
  selectedGem: GemType    // 选中宝石
}
```

**游戏对象状态 (useRef)** - 不触发重渲染,高频更新
```typescript
{
  enemies: Enemy[],       // 敌人列表
  towers: Tower[],        // 塔列表
  bullets: Bullet[],      // 子弹列表
  grid: GridCell[][],     // 地图网格
  storedTowers: Tower[],  // 存储的塔
  currentPath: Path[],    // 当前路径
  spawnQueue: Queue       // 生成队列
}
```

**设计理由**: 
- UI状态变化频率低(资源、波次等),适合用useState
- 游戏对象每帧更新,用useRef避免60fps的重渲染性能问题

---

## 🔧 核心功能模块

### 1. 塔的放置系统

**流程**:
```
选择宝石 → 点击格子 → 验证位置 → BFS寻路检查 → 创建临时塔 → 重新计算路径
```

**关键代码**:
```typescript
const placeTower = useCallback((gridPos) => {
  // 1. 检查资源
  if (!uiState.selectedGem || uiState.wood <= 0) return
  
  // 2. 验证位置
  if (grid[gridPos.row][gridPos.col].type !== 'empty') return
  
  // 3. BFS路径验证(防止堵死)
  if (!validatePlacement(grid, gridPos)) {
    alert('不能堵死路径!')
    return
  }
  
  // 4. 创建塔并扣除木材
  const newTower = createTower(...)
  setUiState(prev => ({ ...prev, wood: prev.wood - 1 }))
  
  // 5. 重新计算路径
  const newPath = calculatePath(grid)
}, [validatePlacement, calculatePath])
```

### 2. 塔的决策系统

**保留塔** - 从地图移到存储区,不阻挡路径
```typescript
decideKeepTower(towerId) {
  // 从地图移除 → 添加到存储区 → 重新计算路径
}
```

**变为障碍** - 永久放置在地图上作为障碍物
```typescript
decideBecomeObstacle(towerId) {
  // 从地图移除 → 格子类型改为obstacle → 重新计算路径
}
```

### 3. 合成系统

**规则**:
- 同类型 + 同等级才能合成
- 等级提升: chipped → flawed → normal → flawless
- 最高等级无法继续合成

```typescript
synthesizeTowers(towerId1, towerId2) {
  // 1. 检查类型和等级
  if (tower1.gemType !== tower2.gemType || tower1.level !== tower2.level) {
    alert('只能合成相同类型和等级的塔!')
    return
  }
  
  // 2. 提升等级
  const newLevel = levels[currentIndex + 1]
  
  // 3. 更新属性
  const upgradedTower = { ...tower1, level: newLevel, ...stats }
}
```

### 4. 波次管理系统

**生成队列机制**:
```typescript
// 波次配置转换为生成队列
const spawnQueue = []
waveConfig.enemies.forEach(config => {
  for (let i = 0; i < config.count; i++) {
    spawnQueue.push({ type: config.type, delay: currentTime })
    currentTime += config.interval
  }
})
```

**动态生成**:
```typescript
spawnEnemies(deltaTime) {
  // 减少delay,当<=0时生成敌人
  spawnQueue.forEach(item => {
    item.delay -= deltaTime
    if (item.delay <= 0) {
      const enemy = createEnemy(item.type, startPos)
      enemies.push(enemy)
    }
  })
}
```

### 5. 战斗系统

#### 敌人移动
```typescript
updateEnemies(deltaTime) {
  // 1. 处理减速效果
  if (enemy.slowTimer > 0) {
    currentSpeed *= 0.5
    enemy.slowTimer -= deltaTime
  }
  
  // 2. 沿路径移动
  const moveDistance = speed * (deltaTime / 1000)
  enemy.progress += moveDistance / distance
  
  // 3. 到达下一个路径点
  if (enemy.progress >= 1) {
    enemy.pathIndex++
    enemy.progress = 0
  }
  
  // 4. 到达终点扣除矿坑生命
  if (reachedEnd) {
    setUiState(prev => ({ ...prev, mineHealth: prev.mineHealth - 1 }))
  }
}
```

#### 塔攻击逻辑
```typescript
processTowerAttacks(deltaTime) {
  towers.forEach(tower => {
    // 1. 查找范围内敌人
    const enemiesInRange = enemies.filter(e => 
      getDistance(e.position, tower.position) <= tower.range
    )
    
    // 2. 选择最近目标
    const target = findClosestEnemy(enemiesInRange)
    
    // 3. 检查冷却时间
    if (now - tower.lastAttackTime >= tower.attackSpeed) {
      // 4. 创建子弹
      bullets.push(createBullet(tower, target))
      tower.lastAttackTime = now
    }
  })
}
```

#### 伤害计算
```typescript
applyDamage(enemy, bullet) {
  let actualDamage = bullet.damage
  
  // 物理伤害减免公式: damage * (1 - armor/(armor+10))
  if (bullet.damageType === 'physical') {
    actualDamage = bullet.damage * (1 - enemy.armor / (enemy.armor + 10))
  }
  // 魔法伤害减免: damage * (1 - magicResist)
  else if (bullet.damageType === 'magic') {
    actualDamage = bullet.damage * (1 - enemy.magicResist)
  }
  // 纯粹伤害无视减免
  
  enemy.health -= actualDamage
  
  // 溅射效果
  if (bullet.splashRadius) {
    enemiesInRange.forEach(other => {
      other.health -= actualDamage * 0.7
    })
  }
  
  // 减速效果
  if (bullet.slowEffect) {
    enemy.slowTimer = 3000
  }
  
  // 死亡奖励
  if (enemy.health <= 0) {
    setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
  }
}
```

#### 子弹追踪
```typescript
updateBullets(deltaTime) {
  bullets.forEach(bullet => {
    const target = enemies.find(e => e.id === bullet.targetId)
    
    if (!target) {
      // 目标已死亡,移除子弹
      bullets.splice(i, 1)
      return
    }
    
    const distance = getDistance(bullet.position, target.position)
    
    if (distance < 10) {
      // 命中
      applyDamage(target, bullet)
      bullets.splice(i, 1)
    } else {
      // 继续移动
      const dx = target.x - bullet.x
      const dy = target.y - bullet.y
      bullet.x += (dx / distance) * speed
      bullet.y += (dy / distance) * speed
    }
  })
}
```

### 6. Canvas渲染系统

**绘制顺序**:
1. 清空画布
2. 绘制网格(地形)
3. 绘制敌人(带血条)
4. 绘制塔(带等级标识)
5. 绘制子弹

**性能优化**:
- 使用Canvas而非DOM元素
- 批量绘制,减少context切换
- 只在playing状态才渲染

---

## ⚡ 性能优化要点

### 1. useRef vs useState
```typescript
// ❌ 错误:每帧重渲染
const [enemies, setEnemies] = useState([])

// ✅ 正确:不触发重渲染
const enemiesRef = useRef([])
```

### 2. useCallback缓存
所有方法都用useCallback包裹,避免每次render都创建新函数

### 3. 游戏循环控制
```typescript
const { start, stop, pause, resume } = useGameLoop(
  update,
  render,
  uiState.gameStatus === 'playing'  // 只在playing时运行
)
```

### 4. DeltaTime限制
```typescript
const clampedDeltaTime = Math.min(deltaTime, 100)  // 防止卡顿后跳跃
```

---

## 🎮 游戏流程

### 准备阶段 (preparing)
1. 玩家选择宝石类型
2. 点击空地放置临时塔
3. 决定保留或变障碍
4. 在存储区合成升级塔
5. 点击"开始下一波"

### 战斗阶段 (playing)
1. 自动生成敌人
2. 塔自动攻击范围内敌人
3. 子弹追踪并造成伤害
4. 敌人到达终点扣除矿坑生命
5. 击杀敌人获得金币

### 波次结束
1. 所有敌人生成完毕且全部死亡/到达终点
2. 自动回到preparing状态
3. 重置木材为5
4. 玩家可以调整防御布局

### 游戏结束条件
- **失败**: 矿坑生命降至0 → game_over
- **胜利**: 完成所有波次(12波) → victory

---

## 🔍 关键技术点

### 1. TypeScript类型安全
- 所有接口都有明确类型定义
- 泛型正确使用
- 无any类型滥用

### 2. React Hooks最佳实践
- useState用于低频UI状态
- useRef用于高频游戏对象
- useCallback避免不必要的重渲染
- useEffect处理副作用

### 3. 函数式编程思想
- 纯函数:calculatePath, validatePlacement
- 不可变数据:通过spread operator创建新对象
- 组合优于继承:Hook组合(useGameLoop + usePathfinding)

### 4. 模块化设计
- 配置与逻辑分离(config/)
- 工具函数独立(utils/)
- Hook职责单一(useGameEngine只负责游戏逻辑)

---

## 📊 代码统计

| 文件 | 行数 | 说明 |
|------|------|------|
| useGameEngine.ts | 784 | 核心游戏引擎 |
| collision.ts | 35 | 碰撞检测工具 |
| GameEngineTest.tsx | 99 | 测试组件 |
| **总计** | **918** | - |

---

## ✅ 实现检查清单

- [x] TypeScript类型完全正确
- [x] 无编译错误
- [x] 完整的注释文档
- [x] 支持基本游戏流程
- [x] 性能优化(useRef避免重渲染)
- [x] 模块化设计
- [x] 可测试性(导出所有方法)

---

## 🚀 下一步工作

1. **交互增强**: 添加鼠标点击事件处理,让玩家能在Canvas上放置塔
2. **UI美化**: 创建美观的游戏界面组件
3. **音效系统**: 添加攻击、击杀等音效
4. **特效系统**: 粒子效果、爆炸动画
5. **存档系统**: localStorage保存游戏进度
6. **移动端适配**: 触摸事件支持

---

## 💡 注意事项

### 内存管理
- 及时清理已死亡的敌人和子弹
- 避免内存泄漏(特别是requestAnimationFrame)

### 边界情况
- 路径被堵死时的提示
- 资源不足时的反馈
- 游戏结束状态的锁定

### 可扩展性
- 新增宝石类型只需修改config/towers.ts
- 新增敌人类型只需修改config/enemies.ts
- 新增波次只需修改config/waves.ts

---

**实现完成时间**: 2026-07-11  
**核心开发者**: AI Assistant  
**技术栈**: React 18 + TypeScript + Canvas API
