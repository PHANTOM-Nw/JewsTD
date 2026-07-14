import type { GemType, GemLevel, SpecialTowerType } from '../types/game'

// 基础塔属性配置 - 8种宝石,每种4个等级
export const BASE_TOWER_STATS: Record<GemType, Record<GemLevel, {
  damage: number
  range: number
  attackSpeed: number
  damageType: 'physical' | 'magic' | 'pure'
  multiTarget?: number          // 钻石特有
  splashRadius?: number         // 黄玉特有
  slowEffect?: number           // 蛋白石特有
  critChance?: number           // 红宝石、紫水晶特有
  critMultiplier?: number       // 红宝石、紫水晶特有
  pierce?: boolean              // 蓝宝石特有
  poisonDamage?: number         // 翡翠特有
  poisonDuration?: number       // 翡翠特有
  stunChance?: number           // 黑曜石特有
  stunDuration?: number         // 黑曜石特有
}>> = {
  // ========== 1. 紫水晶(Amethyst) - 高伤害单体物理攻击 ==========
  amethyst: {
    chipped: { 
      damage: 25, range: 200, attackSpeed: 1200, damageType: 'physical',
      critChance: 0.1, critMultiplier: 2.0  // 10%暴击,2倍伤害
    },
    flawed: { 
      damage: 30, range: 210, attackSpeed: 1200, damageType: 'physical',
      critChance: 0.12, critMultiplier: 2.0
    },
    normal: { 
      damage: 40, range: 220, attackSpeed: 1200, damageType: 'physical',
      critChance: 0.15, critMultiplier: 2.0
    },
    flawless: { 
      damage: 55, range: 230, attackSpeed: 1100, damageType: 'physical',
      critChance: 0.2, critMultiplier: 2.5  // 20%暴击,2.5倍伤害
    }
  },

  // ========== 2. 钻石(Diamond) - 快速多目标物理攻击 ==========
  diamond: {
    chipped: { 
      damage: 8, range: 180, attackSpeed: 400, damageType: 'physical',
      multiTarget: 3
    },
    flawed: { 
      damage: 10, range: 190, attackSpeed: 400, damageType: 'physical',
      multiTarget: 3
    },
    normal: { 
      damage: 13, range: 200, attackSpeed: 350, damageType: 'physical',
      multiTarget: 4
    },
    flawless: { 
      damage: 17, range: 210, attackSpeed: 300, damageType: 'physical',
      multiTarget: 5
    }
  },

  // ========== 3. 黄玉(Topaz) - 溅射范围物理伤害 ==========
  topaz: {
    chipped: { 
      damage: 15, range: 160, attackSpeed: 1000, damageType: 'physical',
      splashRadius: 60
    },
    flawed: { 
      damage: 18, range: 170, attackSpeed: 1000, damageType: 'physical',
      splashRadius: 70
    },
    normal: { 
      damage: 24, range: 180, attackSpeed: 900, damageType: 'physical',
      splashRadius: 80
    },
    flawless: { 
      damage: 32, range: 190, attackSpeed: 800, damageType: 'physical',
      splashRadius: 100
    }
  },

  // ========== 4. 蛋白石(Opal) - 减速魔法伤害 ==========
  opal: {
    chipped: { 
      damage: 10, range: 200, attackSpeed: 800, damageType: 'magic',
      slowEffect: 0.3  // 30%减速
    },
    flawed: { 
      damage: 12, range: 210, attackSpeed: 800, damageType: 'magic',
      slowEffect: 0.4  // 40%减速
    },
    normal: { 
      damage: 16, range: 220, attackSpeed: 750, damageType: 'magic',
      slowEffect: 0.5  // 50%减速
    },
    flawless: { 
      damage: 22, range: 230, attackSpeed: 700, damageType: 'magic',
      slowEffect: 0.6  // 60%减速
    }
  },

  // ========== 5. 红宝石(Ruby) - 纯粹伤害+高暴击 ==========
  ruby: {
    chipped: { 
      damage: 20, range: 190, attackSpeed: 1000, damageType: 'pure',
      critChance: 0.15, critMultiplier: 2.5
    },
    flawed: { 
      damage: 25, range: 200, attackSpeed: 1000, damageType: 'pure',
      critChance: 0.18, critMultiplier: 2.5
    },
    normal: { 
      damage: 35, range: 210, attackSpeed: 900, damageType: 'pure',
      critChance: 0.22, critMultiplier: 3.0
    },
    flawless: { 
      damage: 50, range: 220, attackSpeed: 800, damageType: 'pure',
      critChance: 0.3, critMultiplier: 3.5  // 30%暴击,3.5倍伤害
    }
  },

  // ========== 6. 蓝宝石(Sapphire) - 魔法穿透伤害 ==========
  sapphire: {
    chipped: { 
      damage: 18, range: 210, attackSpeed: 900, damageType: 'magic',
      pierce: true  // 穿透第一个敌人击中后面的
    },
    flawed: { 
      damage: 22, range: 220, attackSpeed: 900, damageType: 'magic',
      pierce: true
    },
    normal: { 
      damage: 30, range: 230, attackSpeed: 850, damageType: 'magic',
      pierce: true
    },
    flawless: { 
      damage: 42, range: 240, attackSpeed: 800, damageType: 'magic',
      pierce: true
    }
  },

  // ========== 7. 翡翠(Emerald) - 毒素持续伤害 ==========
  emerald: {
    chipped: { 
      damage: 12, range: 200, attackSpeed: 1100, damageType: 'magic',
      poisonDamage: 5, poisonDuration: 3000  // 每秒5点伤害,持续3秒
    },
    flawed: { 
      damage: 15, range: 210, attackSpeed: 1100, damageType: 'magic',
      poisonDamage: 7, poisonDuration: 3500
    },
    normal: { 
      damage: 20, range: 220, attackSpeed: 1000, damageType: 'magic',
      poisonDamage: 10, poisonDuration: 4000
    },
    flawless: { 
      damage: 28, range: 230, attackSpeed: 900, damageType: 'magic',
      poisonDamage: 15, poisonDuration: 5000  // 每秒15点伤害,持续5秒
    }
  },

  // ========== 8. 黑曜石(Obsidian) - 眩晕控制 ==========
  obsidian: {
    chipped: { 
      damage: 15, range: 180, attackSpeed: 1300, damageType: 'physical',
      stunChance: 0.1, stunDuration: 1000  // 10%概率眩晕1秒
    },
    flawed: { 
      damage: 18, range: 190, attackSpeed: 1300, damageType: 'physical',
      stunChance: 0.12, stunDuration: 1200
    },
    normal: { 
      damage: 25, range: 200, attackSpeed: 1200, damageType: 'physical',
      stunChance: 0.15, stunDuration: 1500
    },
    flawless: { 
      damage: 35, range: 210, attackSpeed: 1100, damageType: 'physical',
      stunChance: 0.2, stunDuration: 2000  // 20%概率眩晕2秒
    }
  }
}

// 特殊塔配方和特性 - 6种合成塔
export const SPECIAL_TOWER_RECIPES: Record<SpecialTowerType, {
  requiredGems: [GemType, GemType]
  level: GemLevel
  stats: {
    damage: number
    range: number
    attackSpeed: number
    damageType: 'physical' | 'magic' | 'pure'
    
    // 特效
    multiTarget?: number
    splashRadius?: number
    slowEffect?: number
    critChance?: number
    critMultiplier?: number
    pierce?: boolean
    poisonDamage?: number
    poisonDuration?: number
    stunChance?: number
    stunDuration?: number
  }
  description: string
}> = {
  // ========== 银塔(Silver) - 钻石 + 黄玉 ==========
  silver: {
    requiredGems: ['diamond', 'topaz'],
    level: 'normal',
    stats: {
      damage: 20, range: 200, attackSpeed: 600, damageType: 'physical',
      multiTarget: 3, splashRadius: 80
    },
    description: '多目标攻击 + 溅射伤害,强力清场塔'
  },

  // ========== 孔雀石(Malachite) - 黄玉 + 蛋白石 ==========
  malachite: {
    requiredGems: ['topaz', 'opal'],
    level: 'normal',
    stats: {
      damage: 18, range: 190, attackSpeed: 900, damageType: 'magic',
      splashRadius: 90, slowEffect: 0.5
    },
    description: '溅射伤害 + 减速效果,控制和输出兼备'
  },

  // ========== 星红宝石(Star Ruby) - 紫水晶 + 红宝石 ==========
  starRuby: {
    requiredGems: ['amethyst', 'ruby'],
    level: 'normal',
    stats: {
      damage: 50, range: 220, attackSpeed: 800, damageType: 'pure',
      critChance: 0.25, critMultiplier: 3.0
    },
    description: '超高纯粹伤害 + 高暴击,克制高护甲坦克'
  },

  // ========== 月长石(Moonstone) - 蓝宝石 + 蛋白石 ==========
  moonstone: {
    requiredGems: ['sapphire', 'opal'],
    level: 'normal',
    stats: {
      damage: 25, range: 230, attackSpeed: 850, damageType: 'magic',
      pierce: true, slowEffect: 0.4
    },
    description: '魔法穿透 + 减速,远程压制塔'
  },

  // ========== 玉石(Jade) - 翡翠 + 黑曜石 ==========
  jade: {
    requiredGems: ['emerald', 'obsidian'],
    level: 'normal',
    stats: {
      damage: 22, range: 200, attackSpeed: 1000, damageType: 'magic',
      poisonDamage: 12, poisonDuration: 4000,
      stunChance: 0.15, stunDuration: 1500
    },
    description: '毒素伤害 + 眩晕,持续控制塔'
  },

  // ========== 玛瑙(Onyx) - 红宝石 + 黑曜石 ==========
  onyx: {
    requiredGems: ['ruby', 'obsidian'],
    level: 'normal',
    stats: {
      damage: 40, range: 210, attackSpeed: 900, damageType: 'pure',
      critChance: 0.2, critMultiplier: 2.5,
      stunChance: 0.1, stunDuration: 1000
    },
    description: '纯粹伤害 + 暴击 + 眩晕,终极爆发塔'
  }
}

/**
 * 获取塔统计数据
 */
export function getTowerStats(gemType: GemType, level: GemLevel) {
  return BASE_TOWER_STATS[gemType][level]
}

/**
 * 获取特殊塔统计数据
 */
export function getSpecialTowerStats(specialType: SpecialTowerType) {
  return SPECIAL_TOWER_RECIPES[specialType].stats
}

/**
 * 检查是否可以合成特殊塔
 */
export function canCraftSpecialTower(
  storedTowers: Array<{ gemType?: GemType; specialType?: SpecialTowerType }>,
  specialType: SpecialTowerType
): boolean {
  const recipe = SPECIAL_TOWER_RECIPES[specialType]
  const availableTowers = [...storedTowers]

  return recipe.requiredGems.every(gemType => {
    const materialIndex = availableTowers.findIndex(tower => tower.gemType === gemType)

    if (materialIndex === -1) {
      return false
    }

    availableTowers.splice(materialIndex, 1)
    return true
  })
}

export const SYNTHESIZABLE_GEM_LEVELS = ['chipped', 'flawed', 'normal'] as const

type SynthesizableGemLevel = typeof SYNTHESIZABLE_GEM_LEVELS[number]

interface SynthesisCandidate {
  gemType?: GemType
  specialType?: SpecialTowerType
  level: GemLevel
}

type UpgradeableBaseTower<T extends SynthesisCandidate> = T & {
  gemType: GemType
  specialType?: undefined
  level: SynthesizableGemLevel
}

const synthesizableLevelSet: ReadonlySet<GemLevel> = new Set(SYNTHESIZABLE_GEM_LEVELS)

function isUpgradeableBaseTower<T extends SynthesisCandidate>(
  tower: T
): tower is UpgradeableBaseTower<T> {
  return tower.gemType !== undefined
    && tower.specialType === undefined
    && synthesizableLevelSet.has(tower.level)
}

/**
 * 查找所有可进行普通升级合成的塔对。
 */
export function findSynthesizableTowerPairs<T extends SynthesisCandidate>(
  storedTowers: readonly T[]
): Array<[UpgradeableBaseTower<T>, UpgradeableBaseTower<T>]> {
  const candidates = storedTowers.filter(isUpgradeableBaseTower)
  const pairs: Array<[UpgradeableBaseTower<T>, UpgradeableBaseTower<T>]> = []

  for (let firstIndex = 0; firstIndex < candidates.length - 1; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < candidates.length; secondIndex += 1) {
      const firstTower = candidates[firstIndex]
      const secondTower = candidates[secondIndex]

      if (firstTower.gemType === secondTower.gemType && firstTower.level === secondTower.level) {
        pairs.push([firstTower, secondTower])
      }
    }
  }

  return pairs
}

/**
 * 宝石颜色映射
 */
export const GEM_COLORS: Record<GemType, string> = {
  amethyst: '#9370DB',    // 紫色
  diamond: '#FFFFFF',     // 白色
  topaz: '#FFD700',       // 金色
  opal: '#98FB98',        // 浅绿色
  ruby: '#E0115F',        // 深红色
  sapphire: '#0F52BA',    // 蓝色
  emerald: '#50C878',     // 翠绿色
  obsidian: '#353839'     // 黑色
}

/**
 * 特殊塔颜色映射
 */
export const SPECIAL_TOWER_COLORS: Record<SpecialTowerType, string> = {
  silver: '#C0C0C0',      // 银色
  malachite: '#00A86B',   // 深绿色
  starRuby: '#FF0040',    // 亮红色
  moonstone: '#F0F8FF',   // 淡蓝色
  jade: '#00A86B',        // 玉石绿
  onyx: '#000000'         // 纯黑色
}

/**
 * 宝石中文名称
 */
export const GEM_NAMES: Record<GemType, string> = {
  amethyst: '紫水晶',
  diamond: '钻石',
  topaz: '黄玉',
  opal: '蛋白石',
  ruby: '红宝石',
  sapphire: '蓝宝石',
  emerald: '翡翠',
  obsidian: '黑曜石'
}

/**
 * 特殊塔中文名称
 */
export const SPECIAL_TOWER_NAMES: Record<SpecialTowerType, string> = {
  silver: '银塔',
  malachite: '孔雀石',
  starRuby: '星红宝石',
  moonstone: '月长石',
  jade: '玉石',
  onyx: '玛瑙'
}

/**
 * 等级中文名称
 */
export const LEVEL_NAMES: Record<GemLevel, string> = {
  chipped: '碎裂',
  flawed: '有瑕',
  normal: '普通',
  flawless: '无瑕'
}

/**
 * 等级图标
 */
export const LEVEL_ICONS: Record<GemLevel, string> = {
  chipped: 'C',
  flawed: 'F',
  normal: 'N',
  flawless: 'L'
}

/**
 * 塔等级概率配置
 * 根据游戏等级动态调整
 */
export const TOWER_LEVEL_PROBABILITIES = [
  // Level 1-5
  { minLevel: 1, maxLevel: 5, chipped: 0.70, flawed: 0.25, normal: 0.05 },
  // Level 6-10
  { minLevel: 6, maxLevel: 10, chipped: 0.60, flawed: 0.30, normal: 0.10 },
  // Level 11-15
  { minLevel: 11, maxLevel: 15, chipped: 0.50, flawed: 0.35, normal: 0.15 },
  // Level 16-20
  { minLevel: 16, maxLevel: 20, chipped: 0.40, flawed: 0.40, normal: 0.20 },
  // Level 21+
  { minLevel: 21, maxLevel: Infinity, chipped: 0.30, flawed: 0.45, normal: 0.25 }
]

/**
 * 获取当前等级的塔等级概率
 */
export function getTowerLevelProbabilities(gameLevel: number) {
  for (const config of TOWER_LEVEL_PROBABILITIES) {
    if (gameLevel >= config.minLevel && gameLevel <= config.maxLevel) {
      return {
        chipped: config.chipped,
        flawed: config.flawed,
        normal: config.normal
      }
    }
  }
  // 默认返回最低等级配置
  return { chipped: 0.70, flawed: 0.25, normal: 0.05 }
}

/**
 * 根据概率随机选择塔等级
 */
export function randomizeTowerLevel(gameLevel: number): GemLevel {
  const probs = getTowerLevelProbabilities(gameLevel)
  const rand = Math.random()
  
  if (rand < probs.chipped) {
    return 'chipped'
  } else if (rand < probs.chipped + probs.flawed) {
    return 'flawed'
  } else {
    return 'normal'
  }
}

/**
 * 计算升级到下一等级需要的金币
 */
export function calculateUpgradeCost(currentLevel: number): number {
  // 指数增长: 100, 200, 400, 800, 1600...
  return 100 * Math.pow(2, currentLevel - 1)
}
