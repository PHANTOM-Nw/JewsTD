import { useState, useRef, useCallback } from 'react'
import { useGameLoop } from './useGameLoop'
import { usePathfinding } from '../pathfinding/usePathfinding'
import type {
  Enemy,
  Tower,
  Bullet,
  GridCell,
  GemType,
  GemLevel,
  SpecialTowerType,
  EnemyType,
  UIState
} from '../types/game'
import { getTowerStats, SPECIAL_TOWER_RECIPES, GEM_COLORS, SPECIAL_TOWER_COLORS, LEVEL_ICONS, randomizeTowerLevel, calculateUpgradeCost, getTowerLevelProbabilities } from '../config/towers'
import { ENEMY_TYPES, createEnemy } from '../config/enemies'
import { WAVES } from '../config/waves'
import { MAP_CONFIG, initializeGrid, gridToPixel, WAYPOINTS } from '../config/map'
import { ECONOMY_CONFIG } from '../config/economy'
import { soundManager, type SoundType } from '../services/audio'
import {
  canFinalizeTowerBatch,
  canStartConfiguredWave,
  getStateAfterMineDamage,
  getStatusAfterPlacement,
  getStatusAfterWave
} from './gameFlow'
import {
  PIERCE_DAMAGE_MULTIPLIER,
  advancePoisonEffects,
  advanceTimedEffects,
  applyEnemyDamage,
  calculateDamage,
  selectPierceTarget,
  selectTowerTargets
} from './combat'

interface EngineUiState extends UIState {
  selectedGem: GemType | null
  availableGems: GemType[]
}

interface EngineState {
  enemies: Enemy[]
  towers: Tower[]
  bullets: Bullet[]
  grid: GridCell[][]
  storedTowers: Tower[]
  currentPath: { row: number; col: number }[] | null
  waveInProgress: boolean
  spawnQueue: Array<{ type: EnemyType; delay: number }>
  waveElapsedTime: number
  gameTime: number
  currentBatchTowerIds: string[]
  currentHealthMultiplier: number
}

function createInitialUiState(): EngineUiState {
  return {
    wood: ECONOMY_CONFIG.startingWood,
    gold: ECONOMY_CONFIG.startingGold,
    mineHealth: ECONOMY_CONFIG.startingMineHealth,
    maxMineHealth: ECONOMY_CONFIG.startingMineHealth,
    wave: 0,
    gameStatus: 'building',
    selectedGem: null,
    availableGems: [],
    canPlaceTowers: true,
    gameLevel: 1
  }
}

/**
 * 游戏引擎核心Hook
 * 
 * 整合所有游戏系统,包括:
 * - 资源管理(木材、金币、矿坑生命)
 * - 塔的放置、合成、升级
 * - 敌人生成和移动
 * - 战斗系统(攻击、伤害计算、子弹追踪)
 * - 波次管理
 * - Canvas渲染
 * 
 * 使用示例:
 * ```typescript
 * const {
 *   uiState,
 *   gameStateRef,
 *   selectGem,
 *   placeTower,
 *   decideKeepTower,
 *   decideBecomeObstacle,
 *   synthesizeTowers,
 *   startWave,
 *   pause, resume, resetGame
 * } = useGameEngine()
 * ```
 */
export function useGameEngine() {
  // 寻路相关功能
  const { calculatePath, validatePlacement } = usePathfinding()
  
  // ==================== UI状态(触发重渲染) ====================
  const [uiState, setUiState] = useState<EngineUiState>(createInitialUiState)
  
  // ==================== 游戏对象状态(不触发重渲染,高频更新) ====================
  const gameStateRef = useRef<EngineState>(null!)
  if (!gameStateRef.current) {
    const grid = initializeGrid()
    gameStateRef.current = {
      enemies: [],
      towers: [],
      bullets: [],
      grid,
      storedTowers: [],
      currentPath: calculatePath(grid),
      waveInProgress: false,
      spawnQueue: [],
      waveElapsedTime: 0,
      gameTime: 0,
      currentBatchTowerIds: [],
      currentHealthMultiplier: 1
    }
  }
  
  // ==================== 核心方法 ====================
  
  /**
   * 选择宝石类型
   * @param gemType - 要选择的宝石类型
   */
  const selectGem = useCallback((gemType: GemType) => {
    setUiState(prev => ({ ...prev, selectedGem: gemType }))
  }, [])
  
  /**
   * 放置塔到指定位置(随机生成宝石)
   * 
   * 原版宝石TD玩法:
   * 1. 点击地图格子,随机生成1个宝石塔
   * 2. 每次消耗1木材
   * 3. 共放置5次后进入决策阶段
   * 
   * @param gridPos - 格子坐标 {row, col}
   * @returns 新创建的塔,如果放置失败则返回undefined
   */
  const placeTower = useCallback((gridPos: { row: number; col: number }) => {
    if (uiState.gameStatus !== 'building' || !uiState.canPlaceTowers) {
      console.warn('当前不能放置塔')
      return null
    }
    
    if (uiState.wood < ECONOMY_CONFIG.towerWoodCost) {
      alert('木材已用完!')
      return null
    }

    if (gameStateRef.current.currentBatchTowerIds.length >= ECONOMY_CONFIG.towersPerRound) {
      return null
    }
    
    const { grid } = gameStateRef.current

    if (!grid[gridPos.row]?.[gridPos.col]) {
      return null
    }
    
    if (grid[gridPos.row][gridPos.col].type !== 'empty') {
      console.warn('该位置已有建筑,无法放置')
      return null
    }
    
    // 验证是否会堵死路径
    if (!validatePlacement(grid, gridPos)) {
      alert('不能堵死路径!')
      return null
    }
    
    // 随机选择一个宝石类型(8种基础宝石)
    const gemTypes: GemType[] = ['amethyst', 'diamond', 'topaz', 'opal', 'ruby', 'sapphire', 'emerald', 'obsidian']
    const randomIndex = Math.floor(Math.random() * gemTypes.length)
    const randomGemType = gemTypes[randomIndex]
    
    // ✅ 新增: 根据游戏等级随机生成塔等级
    const randomLevel = randomizeTowerLevel(uiState.gameLevel)
    
    // 创建塔
    const stats = getTowerStats(randomGemType, randomLevel)
    const pixelPos = gridToPixel(gridPos.row, gridPos.col)
    
    const newTower: Tower = {
      id: `tower_${Date.now()}_${Math.random()}`,
      gemType: randomGemType,
      level: randomLevel,  // ✅ 使用随机等级
      gridPosition: gridPos,
      position: pixelPos,
      damage: stats.damage,
      range: stats.range,
      attackSpeed: stats.attackSpeed,
      lastAttackTime: 0,
      damageType: stats.damageType,
      critChance: stats.critChance,
      critMultiplier: stats.critMultiplier,
      multiTarget: stats.multiTarget,
      splashRadius: stats.splashRadius,
      slowEffect: stats.slowEffect,
      poisonDamage: stats.poisonDamage,
      poisonDuration: stats.poisonDuration,
      stunChance: stats.stunChance,
      stunDuration: stats.stunDuration,
      pierce: stats.pierce
    }
    
    // 添加到地图(标记为临时塔)
    gameStateRef.current.towers.push(newTower)
    
    gameStateRef.current.currentBatchTowerIds.push(newTower.id)
    const nextBuildState = getStatusAfterPlacement(
      gameStateRef.current.currentBatchTowerIds.length,
      ECONOMY_CONFIG.towersPerRound
    )
    setUiState(prev => ({
      ...prev,
      wood: prev.wood - ECONOMY_CONFIG.towerWoodCost,
      ...nextBuildState
    }))
    
    // ✅ 修改: 更新格子类型为tower(无论是从empty还是obstacle)
    grid[gridPos.row][gridPos.col] = {
      ...grid[gridPos.row][gridPos.col],
      type: 'tower',
      towerId: newTower.id
    }
    
    // 重新计算路径
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
    
    return newTower
  }, [uiState.canPlaceTowers, uiState.gameStatus, uiState.wood, validatePlacement, calculatePath, uiState.gameLevel])

  /** 删除一个障碍物并消耗金币，不占用本轮的5次建造。 */
  const removeObstacle = useCallback((gridPos: { row: number; col: number }) => {
    if (
      (uiState.gameStatus !== 'building' && uiState.gameStatus !== 'ready') ||
      uiState.gold < ECONOMY_CONFIG.obstacleRemovalGoldCost
    ) {
      return false
    }

    const { grid } = gameStateRef.current
    const cell = grid[gridPos.row]?.[gridPos.col]
    if (!cell || cell.type !== 'obstacle') {
      return false
    }

    grid[gridPos.row][gridPos.col] = {
      ...cell,
      type: 'empty',
      towerId: undefined
    }
    gameStateRef.current.currentPath = calculatePath(grid)
    setUiState(prev => ({
      ...prev,
      gold: prev.gold - ECONOMY_CONFIG.obstacleRemovalGoldCost
    }))
    return true
  }, [calculatePath, uiState.gameStatus, uiState.gold])
  
  /**
   * 批量决定5个塔的处理方式
   * 
   * 原版宝石TD核心玩法:
   * - 选择1个塔保留到存储区
   * - 其余4个塔变成障碍物(永久阻挡路径)
   * 
   * @param keepTowerId - 要保留的塔ID
   */
  const finalizeTowers = useCallback((keepTowerId: string) => {
    const { towers, storedTowers, grid, currentBatchTowerIds } = gameStateRef.current

    if (
      uiState.gameStatus !== 'deciding' ||
      !canFinalizeTowerBatch(
        currentBatchTowerIds,
        keepTowerId,
        ECONOMY_CONFIG.towersPerRound
      )
    ) {
      return false
    }
    
    console.log('开始处理塔的决策,保留:', keepTowerId)
    console.log('当前批次塔IDs:', currentBatchTowerIds)
    
    // ✅ 只处理当前批次的塔
    currentBatchTowerIds.forEach(towerId => {
      const tower = towers.find(t => t.id === towerId)
      if (!tower) {
        console.warn('找不到塔:', towerId)
        return
      }
      
      if (tower.id === keepTowerId) {
        // ✅ 保留这个塔: 留在地图上,同时添加到存储区
        console.log(`保留塔: ${tower.gemType} 在位置 (${tower.gridPosition.row}, ${tower.gridPosition.col})`)

        // 创建副本添加到存储区(用于合成)
        const towerCopy = { ...tower }
        storedTowers.push(towerCopy)
        
        // ⚠️ 关键: 不从towers数组移除,格子保持tower类型
        // 这样塔会继续显示在地图上并攻击敌人
        
      } else {
        // 其他塔变成障碍物
        console.log(`塔变为障碍: ${tower.gemType} 在位置 (${tower.gridPosition.row}, ${tower.gridPosition.col})`)
        
        const index = towers.findIndex(t => t.id === tower.id)
        if (index !== -1) {
          towers.splice(index, 1)
        }
        
        const { gridPosition } = tower
        grid[gridPosition.row][gridPosition.col] = {
          ...grid[gridPosition.row][gridPosition.col],
          type: 'obstacle',  // 变成永久障碍物
          towerId: undefined
        }
      }
    })
    
    // 清空当前批次列表
    gameStateRef.current.currentBatchTowerIds = []
    
    // 重新计算路径(因为障碍物变化了)
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath

    setUiState(prev => ({
      ...prev,
      gameStatus: 'ready',
      canPlaceTowers: false
    }))
    
    console.log('最终塔数量:', towers.length, '存储区数量:', storedTowers.length)
    return true
  }, [calculatePath, uiState.gameStatus])
  
  /**
   * 合成两个相同类型和等级的塔
   * 
   * 合成规则:
   * - 必须是相同宝石类型
   * - 必须是相同等级
   * - 等级提升一级(chipped -> flawed -> normal -> flawless)
   * - 最高等级无法继续合成
   * 
   * @param towerId1 - 第一个塔的ID
   * @param towerId2 - 第二个塔的ID
   */
  const synthesizeTowers = useCallback((towerId1: string, towerId2: string) => {
    if (uiState.gameStatus !== 'building' && uiState.gameStatus !== 'ready') {
      return false
    }

    if (towerId1 === towerId2) {
      return false
    }

    const { towers, storedTowers, grid } = gameStateRef.current
    
    // 从存储区找到两个塔
    const tower1Index = storedTowers.findIndex(t => t.id === towerId1)
    const tower2Index = storedTowers.findIndex(t => t.id === towerId2)
    
    if (tower1Index === -1 || tower2Index === -1) {
      console.warn('找不到要合成的塔')
      return false
    }
    
    const tower1 = storedTowers[tower1Index]
    const tower2 = storedTowers[tower2Index]
    
    // 验证是否可以合成
    if (tower1.gemType !== tower2.gemType || tower1.level !== tower2.level) {
      alert('只能合成相同类型和等级的塔!')
      return false
    }
    
    // 检查是否是最高等级
    const levels: GemLevel[] = ['chipped', 'flawed', 'normal', 'flawless']
    const currentIndex = levels.indexOf(tower1.level)
    
    if (currentIndex >= levels.length - 1) {
      alert('已经是最高等级了!')
      return false
    }
    
    const newLevel = levels[currentIndex + 1]
    
    // 创建升级后的塔(使用tower1的位置和属性)
    const stats = getTowerStats(tower1.gemType!, newLevel)
    const upgradedTower: Tower = {
      ...tower1,
      level: newLevel,
      damage: stats.damage,
      range: stats.range,
      attackSpeed: stats.attackSpeed,
      multiTarget: stats.multiTarget,
      splashRadius: stats.splashRadius,
      slowEffect: stats.slowEffect,
      critChance: stats.critChance,
      critMultiplier: stats.critMultiplier,
      poisonDamage: stats.poisonDamage,
      poisonDuration: stats.poisonDuration,
      stunChance: stats.stunChance,
      stunDuration: stats.stunDuration,
      pierce: stats.pierce
    }
    
    // 更新地图上的塔(如果存在)
    const mapTowerIndex = towers.findIndex(t => t.id === tower1.id)
    if (mapTowerIndex !== -1) {
      towers[mapTowerIndex] = upgradedTower
    }
    
    // ✅ 修改: 第二个塔变成障碍物,而不是消失
    const tower2GridPos = tower2.gridPosition
    
    // 从towers数组移除
    const tower2MapIndex = towers.findIndex(t => t.id === towerId2)
    if (tower2MapIndex !== -1) {
      towers.splice(tower2MapIndex, 1)
    }
    
    // 将第二个塔的位置变为障碍物
    grid[tower2GridPos.row][tower2GridPos.col] = {
      type: 'obstacle',
      row: tower2GridPos.row,
      col: tower2GridPos.col
    }
    
    console.log(`✅ 合成材料变为障碍物: (${tower2GridPos.row},${tower2GridPos.col})`)
    
    // 从存储区移除两个旧塔,添加升级后的塔
    gameStateRef.current.storedTowers = storedTowers.filter(
      tower => tower.id !== towerId1 && tower.id !== towerId2
    )
    gameStateRef.current.storedTowers.push(upgradedTower)
    
    // 重新计算路径(因为障碍物变化了)
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
    
    console.log(`合成成功: ${tower1.gemType} ${tower1.level} x2 → ${upgradedTower.gemType} ${newLevel}`)
    return true
  }, [calculatePath, uiState.gameStatus])
  
  /**
   * 合成特殊塔
   * 
   * 特殊塔配方:
   * - 银塔: 钻石 + 黄玉 = 多目标攻击 + 溅射伤害
   * - 孔雀石: 黄玉 + 蛋白石 = 溅射伤害 + 减速效果
   * - 星红宝石: 紫水晶 + 红宝石 = 纯粹伤害 + 高暴击
   * - 月长石: 蓝宝石 + 蛋白石 = 魔法穿透 + 减速
   * - 玉石: 翡翠 + 黑曜石 = 毒素伤害 + 眩晕
   * - 玛瑙: 红宝石 + 黑曜石 = 纯粹伤害 + 暴击 + 眩晕
   * 
   * @param specialType - 特殊塔类型
   */
  const synthesizeSpecialTower = useCallback((specialType: SpecialTowerType) => {
    if (uiState.gameStatus !== 'building' && uiState.gameStatus !== 'ready') {
      return false
    }

    const { towers, storedTowers, grid } = gameStateRef.current
    
    console.log(`开始合成特殊塔: ${specialType}`)
    
    const recipe = SPECIAL_TOWER_RECIPES[specialType]
    if (!recipe) {
      console.error('未知的特殊塔类型:', specialType)
      return false
    }
    
    // 找到需要的材料塔
    const requiredTypes = recipe.requiredGems
    const selectedTowers: Tower[] = []
    
    for (const gemType of requiredTypes) {
      const tower = storedTowers.find(t => t.gemType === gemType && !selectedTowers.includes(t))
      if (!tower) {
        alert(`缺少${gemType}!`)
        return false
      }
      selectedTowers.push(tower)
    }
    
    console.log('选中的材料塔:', selectedTowers.map(t => `${t.gemType} ${t.level}`))
    
    // 创建新的特殊塔
    const firstTower = selectedTowers[0]
    const newTower: Tower = {
      ...firstTower,
      id: firstTower.id,
      gemType: undefined,  // 清除基础宝石类型
      specialType: specialType,  // 设置特殊塔类型
      level: recipe.level,
      damage: recipe.stats.damage,
      range: recipe.stats.range,
      attackSpeed: recipe.stats.attackSpeed,
      damageType: recipe.stats.damageType,
      multiTarget: recipe.stats.multiTarget,
      splashRadius: recipe.stats.splashRadius,
      slowEffect: recipe.stats.slowEffect,
      critChance: recipe.stats.critChance,
      critMultiplier: recipe.stats.critMultiplier,
      poisonDamage: recipe.stats.poisonDamage,
      poisonDuration: recipe.stats.poisonDuration,
      stunChance: recipe.stats.stunChance,
      stunDuration: recipe.stats.stunDuration,
      pierce: recipe.stats.pierce,
      lastAttackTime: 0
    }
    
    // 如果第一个材料塔在地图上,更新地图上的塔
    const mapTowerIndex = towers.findIndex(t => t.id === firstTower.id)
    if (mapTowerIndex !== -1) {
      towers[mapTowerIndex] = newTower
      console.log('更新地图上的塔为新特殊塔')
    } else {
      // 如果不在地图上,添加到地图的空闲位置或存储区
      console.log('材料塔不在地图上,新塔只添加到存储区')
    }
    
    // ✅ 修改: 其他材料塔变成障碍物
    for (let i = 1; i < selectedTowers.length; i++) {
      const materialTower = selectedTowers[i]
      const materialGridPos = materialTower.gridPosition
      
      // 从towers数组移除
      const index = towers.findIndex(t => t.id === materialTower.id)
      if (index !== -1) {
        towers.splice(index, 1)
      }
      
      // 将该位置变为障碍物
      grid[materialGridPos.row][materialGridPos.col] = {
        type: 'obstacle',
        row: materialGridPos.row,
        col: materialGridPos.col
      }
      
      console.log(`✅ 合成材料变为障碍物: (${materialGridPos.row},${materialGridPos.col})`)
    }
    
    // 从存储区移除所有材料塔
    for (const tower of selectedTowers) {
      const index = storedTowers.findIndex(t => t.id === tower.id)
      if (index !== -1) {
        storedTowers.splice(index, 1)
        console.log(`从存储区移除材料塔: ${tower.gemType} ${tower.level}`)
      }
    }
    
    // 将新塔添加到存储区
    storedTowers.push(newTower)
    console.log(`合成成功! 新塔: ${specialType}, 伤害:${newTower.damage}, 范围:${newTower.range}`)
    
    // 重新计算路径(因为可能改变了地图上的塔)
    const newPath = calculatePath(grid)
    gameStateRef.current.currentPath = newPath
    
    const specialNameMap: Record<SpecialTowerType, string> = {
      silver: '银塔',
      malachite: '孔雀石',
      starRuby: '星红宝石',
      moonstone: '月长石',
      jade: '玉石',
      onyx: '玛瑙'
    }
    alert(`成功合成${specialNameMap[specialType]}!`)
    return true
  }, [calculatePath, uiState.gameStatus])
  
  /**
   * ✅ 新增: 升级游戏等级
   * 
   * 游戏等级影响塔生成概率:
   * - 等级越高,高等级塔出现概率越大
   * - 升级需要消耗金币,费用指数增长
   */
  const upgradeGameLevel = useCallback(() => {
    const upgradeCost = calculateUpgradeCost(uiState.gameLevel)
    
    if (uiState.gold < upgradeCost) {
      alert(`金币不足!需要${upgradeCost}金币才能升级到Lv.${uiState.gameLevel + 1}`)
      return
    }
    
    const oldLevel = uiState.gameLevel
    const newLevel = oldLevel + 1
    
    setUiState(prev => ({
      ...prev,
      gold: prev.gold - upgradeCost,
      gameLevel: newLevel
    }))
    
    console.log(`🎉 游戏等级提升: Lv.${oldLevel} → Lv.${newLevel}`)
    console.log(`  消耗金币: ${upgradeCost}`)
    console.log(`  新的塔等级概率:`)
    const probs = getTowerLevelProbabilities(newLevel)
    console.log(`    粗制(chipped): ${(probs.chipped * 100).toFixed(0)}%`)
    console.log(`    有瑕(flawed): ${(probs.flawed * 100).toFixed(0)}%`)
    console.log(`    普通(normal): ${(probs.normal * 100).toFixed(0)}%`)
    
    alert(`成功升级到Lv.${newLevel}!\n高等级塔的出现概率提升了!`)
  }, [uiState.gold, uiState.gameLevel])
  
  /**
   * 开始下一波敌人
   * 
   * 流程:
   * 1. 检查是否还有剩余波次
   * 2. 根据波次配置生成敌人生成队列(应用血量倍率)
   * 3. 锁定放置阶段(波次中不能放置塔)
   * 4. 清空可用宝石
   * 
   * 注意:此函数会自动递增波次数
   */
  const startWave = useCallback(() => {
    const { wave } = uiState

    if (!canStartConfiguredWave(
      uiState.gameStatus,
      wave,
      WAVES.length,
      Boolean(gameStateRef.current.currentPath)
    )) {
      return false
    }
    
    const waveConfig = WAVES[wave]
    const healthMultiplier = waveConfig.healthMultiplier || 1.0
    
    console.log(`🌊 开始第${wave + 1}波`)
    console.log(`  血量倍率: ${healthMultiplier}x`)
    
    // ✅ 保存当前波次的血量倍率
    gameStateRef.current.currentHealthMultiplier = healthMultiplier
    
    // 生成敌人生成队列
    const spawnQueue: Array<{ type: EnemyType; delay: number }> = []
    let currentTime = 0
    
    waveConfig.enemies.forEach(enemyConfig => {
      for (let i = 0; i < enemyConfig.count; i++) {
        spawnQueue.push({
          type: enemyConfig.type,
          delay: currentTime
        })
        currentTime += enemyConfig.interval
      }
    })
    
    spawnQueue.sort((a, b) => a.delay - b.delay)
    
    console.log('生成队列:', spawnQueue) // 调试日志
    
    gameStateRef.current.spawnQueue = spawnQueue
    gameStateRef.current.waveElapsedTime = 0
    gameStateRef.current.waveInProgress = true
    
    // 锁定放置阶段,波次中不能放置塔
    setUiState(prev => ({
      ...prev,
      wood: 0,  // 波次中木材为0
      wave: prev.wave + 1,
      gameStatus: 'playing',
      canPlaceTowers: false,
      availableGems: [],
      selectedGem: null
    }))
    return true
  }, [uiState.gameStatus, uiState.wave])
  
  // ==================== Update函数 ====================
  
  /**
   * 更新敌人位置和状态
   * 
   * 处理:
   * - 沿路径移动
   * - 减速效果计时
   * - 毒素持续伤害
   * - 眩晕状态更新
   * - 到达终点扣除矿坑生命
   * - 清理已到达终点的敌人
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const updateEnemies = useCallback((deltaTime: number) => {
    const { enemies, currentPath } = gameStateRef.current
    
    if (!currentPath || currentPath.length === 0) return
    
    enemies.forEach(enemy => {
      if (enemy.reachedEnd || enemy.isDead) return
      
      // ========== 更新毒素效果 ==========
      if (enemy.poisonEffects && enemy.poisonEffects.length > 0) {
        const poisonUpdate = advancePoisonEffects(enemy.poisonEffects, deltaTime)
        enemy.poisonEffects = poisonUpdate.effects

        if (
          poisonUpdate.damage > 0 &&
          applyEnemyDamage(enemy, poisonUpdate.damage)
        ) {
          setUiState(prev => ({ ...prev, gold: prev.gold + enemy.reward }))
        }
      }

      if (enemy.isDead) return
      
      // ========== 更新眩晕和减速状态 ==========
      const timedEffectUpdate = advanceTimedEffects(enemy, deltaTime)
      enemy.isStunned = timedEffectUpdate.isStunned
      enemy.stunTimer = timedEffectUpdate.stunTimer
      enemy.slowTimer = timedEffectUpdate.slowTimer
      enemy.slowEffect = timedEffectUpdate.slowEffect
      
      if (timedEffectUpdate.travelDistance <= 0) return
      
      if (enemy.pathIndex >= currentPath.length - 1) {
        // 到达终点
        enemy.reachedEnd = true
        
        // 扣除矿坑生命
        setUiState(prev => {
          const mineResult = getStateAfterMineDamage(
            prev.mineHealth,
            enemy.mineDamage,
            prev.gameStatus
          )
          return { ...prev, ...mineResult }
        })
        
        return
      }
      
      const currentPoint = currentPath[enemy.pathIndex]
      const nextPoint = currentPath[enemy.pathIndex + 1]
      
      const currentPixel = gridToPixel(currentPoint.row, currentPoint.col)
      const nextPixel = gridToPixel(nextPoint.row, nextPoint.col)
      
      const dx = nextPixel.x - currentPixel.x
      const dy = nextPixel.y - currentPixel.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      enemy.progress += timedEffectUpdate.travelDistance / distance
      
      if (enemy.progress >= 1) {
        enemy.pathIndex++
        enemy.progress = 0
        enemy.position = { ...nextPixel }
      } else {
        enemy.position = {
          x: currentPixel.x + dx * enemy.progress,
          y: currentPixel.y + dy * enemy.progress
        }
      }
    })
    
    // 清理到达终点或死亡的敌人
    gameStateRef.current.enemies = enemies.filter(e => !e.reachedEnd && !e.isDead)
  }, [])
  
  /**
   * 根据生成队列生成敌人
   * 
   * 处理:
   * - 减少队列中敌人的delay
   * - 当delay<=0时生成敌人(应用血量倍率)
   * - 从队列中移除已生成的敌人
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const spawnEnemies = useCallback((deltaTime: number) => {
    const { spawnQueue, currentHealthMultiplier } = gameStateRef.current
    
    if (!gameStateRef.current.waveInProgress) return
    if (spawnQueue.length === 0) return
    
    gameStateRef.current.waveElapsedTime += deltaTime
    const elapsedTime = gameStateRef.current.waveElapsedTime
    
    // 生成敌人
    while (spawnQueue.length > 0 && spawnQueue[0].delay <= elapsedTime) {
      const spawnData = spawnQueue.shift()!
      
      const path = gameStateRef.current.currentPath
      
      if (!path || path.length === 0) {
        console.warn('没有路径可以生成敌人!')
        continue
      }
      
      const startPos = path[0]
      const pixelPos = gridToPixel(startPos.row, startPos.col)
      
      // ✅ 应用血量倍率创建敌人
      const newEnemy = createEnemy(spawnData.type, pixelPos, currentHealthMultiplier)
      
      gameStateRef.current.enemies.push(newEnemy)
      console.log(`生成敌人: ${spawnData.type}, 血量=${newEnemy.health} (${currentHealthMultiplier}x)`) // 调试日志
    }
  }, [])
  
  /**
   * 处理塔的攻击逻辑
   * 
   * 处理:
   * - 查找范围内的敌人
   * - 选择最近的敌人作为目标
   * - 检查冷却时间
   * - 创建子弹
   * - 🎵 播放攻击音效
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const processTowerAttacks = useCallback(() => {
    const { towers, enemies } = gameStateRef.current
    const now = gameStateRef.current.gameTime
    
    towers.forEach(tower => {
      const targets = selectTowerTargets(tower, enemies)
      if (targets.length === 0) return
      
      // 检查冷却时间
      if (now - tower.lastAttackTime >= tower.attackSpeed) {
        targets.forEach(target => {
          const bullet: Bullet = {
            id: `bullet_${Date.now()}_${Math.random()}`,
            position: { ...tower.position },
            targetId: target.id,
            damage: tower.damage,
            damageType: tower.damageType,
            speed: 300,
            splashRadius: tower.splashRadius,
            slowEffect: tower.slowEffect,
            critChance: tower.critChance,
            critMultiplier: tower.critMultiplier,
            poisonDamage: tower.poisonDamage,
            poisonDuration: tower.poisonDuration,
            stunChance: tower.stunChance,
            stunDuration: tower.stunDuration,
            pierce: tower.pierce
          }

          gameStateRef.current.bullets.push(bullet)
        })
        tower.lastAttackTime = now
        
        // 🎵 播放攻击音效
        const soundType: SoundType = tower.specialType || (tower.gemType as SoundType)
        soundManager.play(soundType)
      }
    })
  }, [])
  
  /**
   * 应用伤害到敌人
   * 
   * 伤害计算公式:
   * - 物理伤害: damage * (1 - armor / (armor + 10))
   * - 魔法伤害: damage * (1 - magicResist)
   * - 纯粹伤害: 无视减免
   * 
   * 额外效果:
   * - 溅射:对范围内其他敌人造成50%伤害
   * - 减速:施加3秒减速效果
   * - 暴击:根据概率造成倍率伤害
   * - 毒素:持续造成伤害
   * - 眩晕:随机概率使敌人停止移动
   * 
   * @param enemy - 目标敌人
   * @param bullet - 子弹
   */
  const applyDamage = useCallback((enemy: Enemy, bullet: Bullet) => {
    const damageTarget = (target: Enemy, damage: number) => {
      if (applyEnemyDamage(target, damage)) {
        setUiState(prev => ({ ...prev, gold: prev.gold + target.reward }))
      }
    }

    const damageResult = calculateDamage(
      bullet.damage,
      bullet.damageType,
      enemy,
      bullet.critChance,
      bullet.critMultiplier
    )
    damageTarget(enemy, damageResult.damage)

    const damageSecondaryTarget = (target: Enemy, multiplier: number) => {
      const result = calculateDamage(
        bullet.damage * multiplier,
        bullet.damageType,
        target,
        0,
        1,
        1
      )
      damageTarget(target, result.damage)
    }
    
    // ========== 溅射效果 ==========
    if (bullet.splashRadius !== undefined) {
      const splashRadius = bullet.splashRadius
      const { enemies } = gameStateRef.current
      enemies.forEach(otherEnemy => {
        if (otherEnemy.id === enemy.id || otherEnemy.isDead) return
        
        const dx = otherEnemy.position.x - enemy.position.x
        const dy = otherEnemy.position.y - enemy.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance <= splashRadius) {
          damageSecondaryTarget(otherEnemy, 0.5)
        }
      })
    }

    // ========== 穿透效果 ==========
    if (bullet.pierce) {
      const nextTarget = selectPierceTarget(
        enemy,
        gameStateRef.current.enemies
      )

      if (nextTarget) {
        damageSecondaryTarget(nextTarget, PIERCE_DAMAGE_MULTIPLIER)
      }
    }

    if (!enemy.isDead) {
      // ========== 减速效果 ==========
      if (bullet.slowEffect) {
        enemy.slowTimer = 3000 // 减速3秒
        enemy.slowEffect = Math.max(enemy.slowEffect ?? 0, bullet.slowEffect)
      }

      // ========== 毒素效果 ==========
      if (bullet.poisonDamage && bullet.poisonDuration) {
        if (!enemy.poisonEffects) {
          enemy.poisonEffects = []
        }

        enemy.poisonEffects.push({
          damage: bullet.poisonDamage,
          duration: bullet.poisonDuration,
          tickAccumulator: 0
        })
      }
      
      // ========== 眩晕效果 ==========
      if (bullet.stunChance && Math.random() < bullet.stunChance) {
        enemy.isStunned = true
        enemy.stunTimer = Math.max(enemy.stunTimer ?? 0, bullet.stunDuration || 1000)
      }
    }

    if (enemy.isDead) {
      gameStateRef.current.enemies = gameStateRef.current.enemies.filter(
        e => e.id !== enemy.id
      )
    }
  }, [])
  
  /**
   * 更新子弹位置和碰撞检测
   * 
   * 处理:
   * - 子弹向目标移动
   * - 检测是否命中目标
   * - 命中后应用伤害
   * - 清理无效子弹(目标已死亡)
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const updateBullets = useCallback((deltaTime: number) => {
    const { bullets, enemies } = gameStateRef.current
    
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i]
      const target = enemies.find(
        enemy => enemy.id === bullet.targetId && !enemy.isDead && !enemy.reachedEnd
      )
      
      if (!target) {
        // 目标已死亡,移除子弹
        bullets.splice(i, 1)
        continue
      }
      
      const dx = target.position.x - bullet.position.x
      const dy = target.position.y - bullet.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      const moveDistance = bullet.speed * (deltaTime / 1000)

      if (distance < 10 || moveDistance >= distance) {
        // 命中目标
        applyDamage(target, bullet)
        bullets.splice(i, 1)
      } else {
        // 继续移动
        bullet.position.x += (dx / distance) * moveDistance
        bullet.position.y += (dy / distance) * moveDistance
      }
    }
  }, [applyDamage])
  
  /**
   * 主更新函数
   * 
   * 按顺序执行:
   * 1. 生成敌人
   * 2. 更新敌人位置
   * 3. 处理塔攻击
   * 4. 更新子弹
   * 5. 检查波次是否完成
   * 
   * @param deltaTime - 距离上一帧的时间间隔(ms)
   */
  const update = useCallback((deltaTime: number) => {
    if (uiState.gameStatus !== 'playing') return
    
    gameStateRef.current.gameTime += deltaTime
    spawnEnemies(deltaTime)
    updateEnemies(deltaTime)
    processTowerAttacks()
    updateBullets(deltaTime)
    
    // 检查波次是否完成
    if (gameStateRef.current.waveInProgress) {
      const allEnemiesDead = gameStateRef.current.enemies.every(e => e.isDead)
      const noMoreSpawns = gameStateRef.current.spawnQueue.length === 0
      
      if (allEnemiesDead && noMoreSpawns) {
        // 波次完成
        gameStateRef.current.waveInProgress = false
        gameStateRef.current.bullets = []
        
        setUiState(prev => {
          if (prev.gameStatus === 'game_over') return prev

          const nextStatus = getStatusAfterWave(prev.wave, WAVES.length)
          const canBuild = nextStatus === 'building'
          return {
            ...prev,
            wood: canBuild ? ECONOMY_CONFIG.woodPerRound : 0,
            gameStatus: nextStatus,
            canPlaceTowers: canBuild
          }
        })
        
        console.log(`第${uiState.wave}波完成!`)
      }
    }
  }, [uiState.gameStatus, uiState.wave, spawnEnemies, updateEnemies, processTowerAttacks, updateBullets])
  
  // ==================== Render函数 ====================
  
  /**
   * 渲染函数 - 绘制整个游戏画面
   * 
   * 绘制顺序:
   * 1. 清空画布
   * 2. 绘制网格(地形)
   * 3. 绘制敌人
   * 4. 绘制塔
   * 5. 绘制子弹
   */
  const render = useCallback(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const { grid, enemies, towers, bullets } = gameStateRef.current
    
    // 清空画布(考虑设备像素比)
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    
    // 绘制网格
    drawGrid(ctx, grid)

    if (gameStateRef.current.currentPath) {
      drawPath(ctx, gameStateRef.current.currentPath)
    }
    
    // 绘制必经点(在所有元素之前)
    drawWaypoints(ctx)
    
    // 绘制敌人 - 确保这里被调用
    enemies.forEach(enemy => {
      if (!enemy.reachedEnd) {
        drawEnemy(ctx, enemy)
      }
    })
    
    // 绘制塔 - 确保这里绘制了所有塔
    towers.forEach(tower => drawTower(ctx, tower))
    
    // 绘制子弹
    bullets.forEach(bullet => drawBullet(ctx, bullet))
  }, [])
  
  /**
   * 绘制网格(地形)
   * @param ctx - Canvas上下文
   * @param grid - 地图网格
   */
  const drawGrid = (ctx: CanvasRenderingContext2D, grid: GridCell[][]) => {
    const { cellSize } = MAP_CONFIG
    
    grid.forEach(row => {
      row.forEach(cell => {
        const x = cell.col * cellSize
        const y = cell.row * cellSize
        
        // 根据类型绘制不同颜色
        switch (cell.type) {
          case 'empty':
            ctx.fillStyle = '#F0F0F0'
            break
          case 'obstacle':
            ctx.fillStyle = '#8B4513'
            break
          case 'start':
            ctx.fillStyle = '#90EE90'
            break
          case 'end':
            ctx.fillStyle = '#FF6B6B'
            break
          case 'mine':
            ctx.fillStyle = '#FFD700'
            break
          default:
            ctx.fillStyle = '#FFFFFF'
        }
        
        ctx.fillRect(x, y, cellSize, cellSize)
        ctx.strokeStyle = '#CCCCCC'
        ctx.strokeRect(x, y, cellSize, cellSize)
      })
    })
  }

  const drawPath = (
    ctx: CanvasRenderingContext2D,
    path: { row: number; col: number }[]
  ) => {
    const { cellSize } = MAP_CONFIG
    ctx.save()
    ctx.strokeStyle = 'rgba(244, 67, 54, 0.35)'
    ctx.lineWidth = 3
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    path.forEach((point, index) => {
      const x = point.col * cellSize + cellSize / 2
      const y = point.row * cellSize + cellSize / 2
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.restore()
  }
  
  /**
   * 绘制必经点标记
   * @param ctx - Canvas上下文
   */
  const drawWaypoints = (ctx: CanvasRenderingContext2D) => {
    const { cellSize } = MAP_CONFIG
    
    // 为每个必经点绘制不同颜色的标记
    WAYPOINTS.forEach((waypoint, index) => {
      const x = waypoint.col * cellSize + cellSize / 2
      const y = waypoint.row * cellSize + cellSize / 2
      
      // 根据类型选择颜色
      let color: string
      let radius: number
      
      if (index === 0) {
        // 起点 - 绿色大圆
        color = '#90EE90'
        radius = 12
      } else if (index === WAYPOINTS.length - 1) {
        // 终点 - 红色大圆
        color = '#FF6B6B'
        radius = 12
      } else if (waypoint.label === '矿坑') {
        // 矿坑 - 黄色中圆
        color = '#FFD700'
        radius = 10
      } else {
        // 转折点 - 蓝色小圆
        color = '#4169E1'
        radius = 8
      }
      
      // 绘制圆形标记
      ctx.fillStyle = color
      ctx.globalAlpha = 0.7  // 半透明
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      
      // 绘制边框
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 2
      ctx.globalAlpha = 1.0
      ctx.stroke()
      
      // 绘制标签文字(索引数字)
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${index}`, x, y)
      
      // 如果有label,在下方显示
      if (waypoint.label) {
        ctx.fillStyle = '#333333'
        ctx.font = '9px Arial'
        ctx.fillText(waypoint.label, x, y + radius + 10)
      }
    })
    
  }
  
  /**
   * 绘制敌人
   * @param ctx - Canvas上下文
   * @param enemy - 敌人对象
   */
  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const config = ENEMY_TYPES[enemy.type]
    
    // 绘制敌人身体
    ctx.fillStyle = config.color
    ctx.beginPath()
    ctx.arc(enemy.position.x, enemy.position.y, config.radius, 0, Math.PI * 2)
    ctx.fill()
    
    // 绘制边框
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // 绘制血条背景
    const barWidth = 24
    const barHeight = 4
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(
      enemy.position.x - barWidth / 2,
      enemy.position.y - config.radius - 8,
      barWidth,
      barHeight
    )
    
    // 绘制血条前景
    const healthPercent = Math.max(0, Math.min(enemy.health / enemy.maxHealth, 1))
    ctx.fillStyle = '#00FF00'
    ctx.fillRect(
      enemy.position.x - barWidth / 2,
      enemy.position.y - config.radius - 8,
      barWidth * healthPercent,
      barHeight
    )
    
    // 绘制中毒效果
    if (enemy.poisonEffects && enemy.poisonEffects.length > 0) {
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(enemy.position.x, enemy.position.y, config.radius + 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    // 绘制眩晕效果
    if (enemy.isStunned) {
      ctx.fillStyle = '#FFFF00'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('💫', enemy.position.x, enemy.position.y - config.radius - 15)
    }
  }
  
  /**
   * 绘制塔
   * @param ctx - Canvas上下文
   * @param tower - 塔对象
   */
  const drawTower = (ctx: CanvasRenderingContext2D, tower: Tower) => {
    // 确定颜色
    let color: string
    if (tower.specialType) {
      color = SPECIAL_TOWER_COLORS[tower.specialType]
    } else if (tower.gemType) {
      color = GEM_COLORS[tower.gemType]
    } else {
      color = '#CCCCCC'
    }
    
    // 绘制塔底座
    ctx.fillStyle = color
    ctx.fillRect(
      tower.position.x - 18,
      tower.position.y - 18,
      36,
      36
    )
    
    // 绘制边框
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2
    ctx.strokeRect(
      tower.position.x - 18,
      tower.position.y - 18,
      36,
      36
    )
    
    // 绘制等级标识
    const levelIcon = LEVEL_ICONS[tower.level]
    ctx.fillStyle = tower.gemType === 'diamond' || tower.specialType === 'moonstone' ? '#333' : 'white'
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(levelIcon, tower.position.x, tower.position.y)
    
    // 绘制特效标识
    if (tower.multiTarget) {
      ctx.fillStyle = '#FFD700'
      ctx.font = '10px Arial'
      ctx.fillText(`×${tower.multiTarget}`, tower.position.x, tower.position.y + 12)
    }
    
    // 绘制溅射范围(仅当选中时)
    // 这里可以后续添加交互逻辑
  }
  
  /**
   * 绘制子弹
   * @param ctx - Canvas上下文
   * @param bullet - 子弹对象
   */
  const drawBullet = (ctx: CanvasRenderingContext2D, bullet: Bullet) => {
    // 绘制子弹主体
    ctx.fillStyle = '#FF4500'
    ctx.beginPath()
    ctx.arc(bullet.position.x, bullet.position.y, 4, 0, Math.PI * 2)
    ctx.fill()
    
    // 添加拖尾效果
    ctx.strokeStyle = 'rgba(255, 69, 0, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bullet.position.x, bullet.position.y)
    ctx.lineTo(bullet.position.x - 8, bullet.position.y)
    ctx.stroke()
  }
  
  // ==================== 整合游戏循环 ====================
  
  useGameLoop(
    update,
    render,
    uiState.gameStatus === 'building' ||
      uiState.gameStatus === 'deciding' ||
      uiState.gameStatus === 'ready' ||
      uiState.gameStatus === 'playing'
  )

  const pause = useCallback(() => {
    setUiState(prev => prev.gameStatus === 'playing'
      ? { ...prev, gameStatus: 'paused' }
      : prev)
  }, [])

  const resume = useCallback(() => {
    setUiState(prev => prev.gameStatus === 'paused'
      ? { ...prev, gameStatus: 'playing' }
      : prev)
  }, [])

  const resetGame = useCallback(() => {
    const grid = initializeGrid()
    gameStateRef.current = {
      enemies: [],
      towers: [],
      bullets: [],
      grid,
      storedTowers: [],
      currentPath: calculatePath(grid),
      waveInProgress: false,
      spawnQueue: [],
      waveElapsedTime: 0,
      gameTime: 0,
      currentBatchTowerIds: [],
      currentHealthMultiplier: 1
    }
    setUiState(createInitialUiState())
  }, [calculatePath])
  
  return {
    uiState,
    gameStateRef,
    selectGem,
    placeTower,
    removeObstacle,
    finalizeTowers,
    synthesizeTowers,
    synthesizeSpecialTower,  // 新增
    upgradeGameLevel,  // ✅ 新增: 升级游戏等级
    startWave,
    pause,
    resume,
    resetGame
  }
}
