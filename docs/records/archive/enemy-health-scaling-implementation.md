# 敌人血量倍率配置说明（实现归档）

> 归档说明：这是一次历史实现记录，不作为当前数值的唯一来源。

## 📊 修改概览

本次更新为游戏添加了**随波次递增的敌人血量系统**,使游戏难度逐渐提升,增强挑战性和可玩性。

---

## 🔧 技术实现

### 1. 类型定义扩展 (`src/types/game.ts`)

在 `WaveConfig` 接口中添加了可选的血量倍率字段:

```typescript
export interface WaveConfig {
  waveNumber: number
  enemies: WaveEnemyConfig[]
  isBossWave?: boolean
  healthMultiplier?: number  // ✅ 新增: 血量倍率(默认1.0)
}
```

### 2. 敌人创建函数增强 (`src/config/enemies.ts`)

修改 `createEnemy` 函数,支持血量倍率参数:

```typescript
export function createEnemy(
  type: 'basic' | 'fast' | 'tank',
  startPosition: { x: number; y: number },
  healthMultiplier: number = 1.0  // ✅ 新增参数
): Enemy {
  const config = ENEMY_TYPES[type]
  
  // ✅ 应用血量倍率
  const actualHealth = Math.floor(config.health * healthMultiplier)
  
  return {
    id: `enemy_${Date.now()}_${Math.random()}`,
    type,
    position: startPosition,
    health: actualHealth,      // ✅ 使用计算后的血量
    maxHealth: actualHealth,   // ✅ 使用计算后的血量
    speed: config.speed,
    armor: config.armor,
    magicResist: config.magicResist,
    pathIndex: 0,
    progress: 0,
    reward: config.reward
  }
}
```

### 3. 波次配置更新 (`src/config/waves.ts`)

为每波添加 `healthMultiplier` 字段,难度从 **1.0x → 8.5x** 递增:

| 阶段 | 波次范围 | 血量倍率范围 | 难度描述 |
|------|---------|-------------|---------|
| 第1阶段: 新手教学 | 波次1-3 | 1.0x - 1.5x | 确保可通关 |
| 第2阶段: 逐渐加强 | 波次4-6 | 1.8x - 2.7x | 中等挑战 |
| 第3阶段: 中期挑战 | 波次7-9 | 3.3x - 4.8x | 高难度 |
| 第4阶段: 后期困难 | 波次10-12 | 5.8x - 8.5x | 极高难度 |

### 4. 游戏引擎集成 (`src/hooks/useGameEngine.ts`)

#### 4.1 状态管理扩展

在 `gameStateRef` 中添加当前波次的血量倍率:

```typescript
const gameStateRef = useRef({
  // ... 其他字段
  currentHealthMultiplier: 1.0 as number  // ✅ 新增: 当前波次的血量倍率
})
```

#### 4.2 startWave 函数更新

在开始波次时保存血量倍率并输出日志:

```typescript
const startWave = useCallback(() => {
  const waveConfig = WAVES[wave]
  const healthMultiplier = waveConfig.healthMultiplier || 1.0
  
  console.log(`🌊 开始第${wave + 1}波`)
  console.log(`  血量倍率: ${healthMultiplier}x`)  // ✅ 控制台显示
  
  // ✅ 保存当前波次的血量倍率
  gameStateRef.current.currentHealthMultiplier = healthMultiplier
  
  // ... 其余逻辑
}, [uiState.wave])
```

#### 4.3 spawnEnemies 函数更新

在生成敌人时应用血量倍率:

```typescript
const spawnEnemies = useCallback(() => {
  const { spawnQueue, waveStartTime, currentHealthMultiplier } = gameStateRef.current
  
  // ... 省略部分代码
  
  while (spawnQueue.length > 0 && spawnQueue[0].delay <= elapsedTime) {
    const spawnData = spawnQueue.shift()!
    
    // ✅ 应用血量倍率创建敌人
    const newEnemy = createEnemy(spawnData.type, pixelPos, currentHealthMultiplier)
    
    gameStateRef.current.enemies.push(newEnemy)
    console.log(`生成敌人: ${spawnData.type}, 血量=${newEnemy.health} (${currentHealthMultiplier}x)`)
  }
}, [])
```

---

## 📈 完整血量配置表

### 基础敌人属性 (未应用倍率前)

| 敌人类型 | 基础血量 | 速度 | 护甲 | 魔抗 | 奖励金币 |
|---------|---------|------|------|------|---------|
| basic (普通) | 50 | 60 | 0 | 0 | 5 |
| fast (快速) | 35 | 100 | 0 | 0 | 7 |
| tank (坦克) | 150 | 40 | 5 | 0.2 | 15 |

### 各波次实际血量 (应用倍率后)

#### 第1阶段: 新手教学 (波次1-3)

| 波次 | 血量倍率 | basic血量 | fast血量 | tank血量 | 敌人组成 |
|-----|---------|----------|---------|---------|---------|
| 1 | **1.0x** | 50 | 35 | 150 | 5×basic |
| 2 | **1.2x** | 60 | 42 | 180 | 8×basic |
| 3 | **1.5x** | 75 | 53 | 225 | 6×basic + 3×fast |

#### 第2阶段: 逐渐加强 (波次4-6)

| 波次 | 血量倍率 | basic血量 | fast血量 | tank血量 | 敌人组成 |
|-----|---------|----------|---------|---------|---------|
| 4 | **1.8x** | 90 | 63 | 270 | 10×basic + 5×fast |
| 5 | **2.2x** | 110 | 77 | 330 | 8×basic + 6×fast + 2×tank |
| 6 | **2.7x** | 135 | 95 | 405 | 12×basic + 8×fast + 3×tank |

#### 第3阶段: 中期挑战 (波次7-9)

| 波次 | 血量倍率 | basic血量 | fast血量 | tank血量 | 敌人组成 |
|-----|---------|----------|---------|---------|---------|
| 7 | **3.3x** | 165 | 116 | 495 | 12×basic + 10×fast + 4×tank |
| 8 | **4.0x** | 200 | 140 | 600 | 15×basic + 12×fast + 5×tank |
| 9 | **4.8x** | 240 | 168 | 720 | 15×basic + 15×fast + 6×tank |

#### 第4阶段: 后期困难 (波次10-12)

| 波次 | 血量倍率 | basic血量 | fast血量 | tank血量 | 敌人组成 |
|-----|---------|----------|---------|---------|---------|
| 10 | **5.8x** | 290 | 203 | 870 | 20×basic + 15×fast + 8×tank |
| 11 | **7.0x** | 350 | 245 | 1050 | 20×basic + 18×fast + 10×tank |
| 12 | **8.5x** | 425 | 298 | 1275 | 25×basic + 20×fast + 12×tank (Boss波) |

---

## 🎮 游戏平衡性设计

### 难度曲线分析

1. **平缓起步 (1.0x - 1.5x)**
   - 第1波保持100%血量,确保新手能轻松通关
   - 第2-3波小幅增加,让玩家适应节奏

2. **稳步上升 (1.8x - 2.7x)**
   - 第4-6波引入更多敌人类型
   - 血量适中增长,考验玩家的塔布局策略

3. **显著挑战 (3.3x - 4.8x)**
   - 第7-9波血量翻倍以上
   - 需要玩家合理合成高级塔才能应对

4. **极限考验 (5.8x - 8.5x)**
   - 第10-12波血量接近10倍
   - 要求玩家精通合成机制和特殊塔搭配

### 防御塔伤害参考

以紫水晶塔为例:
- Chipped (碎裂): 25 伤害
- Flawed (有瑕): 40 伤害
- Normal (普通): 60 伤害
- Flawless (无瑕): 90 伤害

**击杀所需攻击次数对比**:

| 波次 | basic血量 | 碎裂紫水晶需攻击次数 | 无瑕紫水晶需攻击次数 |
|-----|----------|-------------------|-------------------|
| 1 | 50 | 2次 | 1次 |
| 3 | 75 | 3次 | 1次 |
| 6 | 135 | 6次 | 2次 |
| 9 | 240 | 10次 | 3次 |
| 12 | 425 | 17次 | 5次 |

---

## ✅ 验证清单

- [x] TypeScript 无编译错误
- [x] 第1波血量倍率为1.0x (确保可通关)
- [x] 后续波次难度合理递增 (1.2x → 8.5x)
- [x] 控制台显示每波的血量倍率
- [x] 控制台显示每个敌人的实际血量
- [x] 保持原有的敌人数量和间隔时间配置
- [x] 数据驱动设计,便于后期调整平衡性

---

## 🔍 调试信息

### 控制台输出示例

启动第5波时的控制台输出:

```
🌊 开始第5波
  血量倍率: 2.2x
波次开始,重置当前批次塔列表
生成敌人: basic, 血量=110 (2.2x)
生成敌人: basic, 血量=110 (2.2x)
...
生成敌人: fast, 血量=77 (2.2x)
...
生成敌人: tank, 血量=330 (2.2x)
```

---

## 📝 未来优化建议

1. **动态难度调整**: 根据玩家表现自动调整血量倍率
2. **特殊敌人**: 添加具有特殊能力的敌人类型
3. **Boss机制**: 为Boss波添加独特的技能和行为模式
4. **成就系统**: 记录玩家通关的最高波次和最快时间
5. **排行榜**: 全球/好友排行榜,增加竞争性

---

## 📚 相关文件

- `src/types/game.ts` - 类型定义
- `src/config/enemies.ts` - 敌人配置和创建函数
- `src/config/waves.ts` - 波次配置
- `src/hooks/useGameEngine.ts` - 游戏引擎核心逻辑

---

**最后更新**: 2026-07-11  
**版本**: v1.0  
**作者**: Qoder AI Assistant
