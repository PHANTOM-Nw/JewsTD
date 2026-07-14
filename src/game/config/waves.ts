import type { WaveConfig } from '../types/game'

/**
 * 波次配置
 * 每波敌人数量、类型和血量倍率
 */
export const WAVES: WaveConfig[] = [
  // ========== 第1阶段: 新手教学 (波次1-3) ==========
  { 
    waveNumber: 1, 
    enemies: [{ type: 'basic', count: 5, interval: 2000 }],
    healthMultiplier: 1.0  // 100%血量 - 确保可通关
  },
  { 
    waveNumber: 2, 
    enemies: [{ type: 'basic', count: 8, interval: 1800 }],
    healthMultiplier: 1.2  // 120%血量
  },
  { 
    waveNumber: 3, 
    enemies: [
      { type: 'basic', count: 6, interval: 1500 },
      { type: 'fast', count: 3, interval: 1200 }
    ],
    healthMultiplier: 1.5  // 150%血量
  },
  
  // ========== 第2阶段: 逐渐加强 (波次4-6) ==========
  { 
    waveNumber: 4, 
    enemies: [
      { type: 'basic', count: 10, interval: 1500 },
      { type: 'fast', count: 5, interval: 1000 }
    ],
    healthMultiplier: 1.8  // 180%血量
  },
  { 
    waveNumber: 5, 
    enemies: [
      { type: 'basic', count: 8, interval: 1200 },
      { type: 'fast', count: 6, interval: 800 },
      { type: 'tank', count: 2, interval: 3000 }
    ],
    healthMultiplier: 2.2  // 220%血量
  },
  { 
    waveNumber: 6, 
    enemies: [
      { type: 'basic', count: 12, interval: 1000 },
      { type: 'fast', count: 8, interval: 700 },
      { type: 'tank', count: 3, interval: 2500 }
    ],
    healthMultiplier: 2.7  // 270%血量
  },
  
  // ========== 第3阶段: 中期挑战 (波次7-9) ==========
  { 
    waveNumber: 7, 
    enemies: [
      { type: 'basic', count: 12, interval: 1000 },
      { type: 'fast', count: 10, interval: 700 },
      { type: 'tank', count: 4, interval: 2200 }
    ],
    healthMultiplier: 3.3  // 330%血量
  },
  { 
    waveNumber: 8, 
    enemies: [
      { type: 'basic', count: 15, interval: 900 },
      { type: 'fast', count: 12, interval: 600 },
      { type: 'tank', count: 5, interval: 2000 }
    ],
    healthMultiplier: 4.0  // 400%血量
  },
  { 
    waveNumber: 9, 
    enemies: [
      { type: 'basic', count: 15, interval: 800 },
      { type: 'fast', count: 15, interval: 600 },
      { type: 'tank', count: 6, interval: 1800 }
    ],
    healthMultiplier: 4.8  // 480%血量
  },
  
  // ========== 第4阶段: 后期困难 (波次10-12) ==========
  { 
    waveNumber: 10, 
    enemies: [
      { type: 'basic', count: 20, interval: 800 },
      { type: 'fast', count: 15, interval: 600 },
      { type: 'tank', count: 8, interval: 1600 }
    ],
    healthMultiplier: 5.8  // 580%血量
  },
  { 
    waveNumber: 11, 
    enemies: [
      { type: 'basic', count: 20, interval: 700 },
      { type: 'fast', count: 18, interval: 500 },
      { type: 'tank', count: 10, interval: 1400 }
    ],
    healthMultiplier: 7.0  // 700%血量
  },
  { 
    waveNumber: 12, 
    enemies: [
      { type: 'basic', count: 25, interval: 600 },
      { type: 'fast', count: 20, interval: 500 },
      { type: 'tank', count: 12, interval: 1200 },
      { type: 'boss', count: 1, interval: 1000 }
    ],
    isBossWave: true,
    healthMultiplier: 8.5  // 850%血量 - 最终Boss波
  }
]
