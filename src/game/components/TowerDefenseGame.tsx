import React, { useState, useCallback } from 'react'
import { useGameEngine } from '../engine/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel } from './BuildPanel'
import { SynthesisDialog } from './SynthesisDialog'
import { WaveCompletionNotice } from './WaveCompletionNotice'
import type { GemLevel, GemType, Tower } from '../types/game'
import { GEM_NAMES, LEVEL_NAMES } from '../config/towers'
import { ECONOMY_CONFIG } from '../config/economy'
import { canInspectSynthesisFromTower, canSynthesizeTowers } from '../engine/gameFlow'
import { getTowerSpriteUrl } from '../rendering/spriteRegistry'
import './TowerDefenseGame.css'

export const TowerDefenseGame: React.FC = () => {
  const {
    uiState,
    gameStateRef,
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
  } = useGameEngine()
  
  // 跟踪当前批次放置的塔
  const [currentBatchTowers, setCurrentBatchTowers] = useState<string[]>([])
  const [selectedTowerForDecision, setSelectedTowerForDecision] = useState<Tower | null>(null)
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false)
  const [selectedTowerForSynthesisId, setSelectedTowerForSynthesisId] = useState<string | null>(null)

  // 辅助函数:获取宝石名称
  const getGemName = (gemType: GemType): string => {
    return GEM_NAMES[gemType]
  }

  // 辅助函数:获取等级名称
  const getLevelName = (level: GemLevel): string => {
    return LEVEL_NAMES[level]
  }

  const handleCanvasClick = useCallback((gridPos: { row: number; col: number }) => {
    const { grid, towers } = gameStateRef.current
    
    // 检查点击的位置是否有塔或障碍物
    const cell = grid[gridPos.row][gridPos.col]
    
    if (cell.type === 'tower') {
      // 点击的是已有塔 - 现有逻辑保持不变
      const existingTower = towers.find(t => t.id === cell.towerId)
      
      if (existingTower) {
        const isCurrentBatch = gameStateRef.current.currentBatchTowerIds.includes(existingTower.id)
        
        if (isCurrentBatch && uiState.gameStatus === 'deciding') {
          setSelectedTowerForDecision(existingTower)
        } else if (
          canInspectSynthesisFromTower(uiState.gameStatus)
          && gameStateRef.current.storedTowers.some(tower => tower.id === existingTower.id)
        ) {
          setSelectedTowerForSynthesisId(existingTower.id)
          setShowSynthesisDialog(true)
        }
        
        return
      }
    }
    
    // 点击障碍物,消耗金币删除
    if (cell.type === 'obstacle') {
      if (uiState.gameStatus !== 'building' && uiState.gameStatus !== 'ready') {
        return
      }

      if (uiState.gold < ECONOMY_CONFIG.obstacleRemovalGoldCost) {
        alert(`需要${ECONOMY_CONFIG.obstacleRemovalGoldCost}金币才能删除障碍物!`)
        return
      }
      
      removeObstacle(gridPos)
      return
    }
    
    // 点击空地,执行放置逻辑
    if (uiState.gameStatus !== 'building') return
    if (!uiState.canPlaceTowers) {
      console.warn('当前波次中不能放置塔')
      return
    }
    
    // 检查是否还有木材
    if (uiState.wood <= 0) {
      console.warn('木材已用完,无法放置新塔')
      return
    }
    
    const tower = placeTower(gridPos)
    if (tower) {
      setCurrentBatchTowers(prev => [...prev, tower.id])
      
      // 达到当前配置的批次数量后，自动进入决策模式
      if (currentBatchTowers.length + 1 >= ECONOMY_CONFIG.towersPerRound) {
        // 默认选中第一个塔
        const firstTowerId = currentBatchTowers.length > 0 
          ? currentBatchTowers[0] 
          : tower.id
        const firstTower = gameStateRef.current.towers.find(t => t.id === firstTowerId)
        if (firstTower) {
          setSelectedTowerForDecision(firstTower)
        }
      }
    }
  }, [
    uiState.gameStatus, 
    uiState.canPlaceTowers, 
    uiState.wood,
    uiState.gold,
    placeTower, 
    currentBatchTowers,
    gameStateRef,
    removeObstacle
  ])

  const handleFinalizeTowers = (keepTowerId: string) => {
    if (finalizeTowers(keepTowerId)) {
      setCurrentBatchTowers([])
      setSelectedTowerForDecision(null)
    }
  }

  const handleStartWave = () => {
    startWave()
  }

  const handlePause = () => {
    pause()
  }

  const handleResume = () => {
    resume()
  }

  const handleResetGame = () => {
    resetGame()
    setCurrentBatchTowers([])
    setSelectedTowerForDecision(null)
    setShowSynthesisDialog(false)
    setSelectedTowerForSynthesisId(null)
  }

  return (
    <div className="game-shell">
      <h1 className="game-title">宝石TD</h1>
      
      {/* 顶部UI */}
      <GameUI
        uiState={uiState}
        onUpgradeGameLevel={upgradeGameLevel}
        onResetGame={handleResetGame}
      />

      <WaveCompletionNotice
        gameStatus={uiState.gameStatus}
        currentWave={uiState.wave}
      />
      
      {/* 游戏主体区域 */}
      <div className="game-main">
        <div className="game-board">
          <GameCanvas onClick={handleCanvasClick} />
          
          {/* 决策对话框 */}
          {uiState.gameStatus === 'deciding' && selectedTowerForDecision && (
            <section className="tower-decision" role="dialog" aria-modal="true" aria-labelledby="tower-decision-title">
              <span className="tower-decision__eyebrow">三选一</span>
              <h2 id="tower-decision-title">选择要保留的塔</h2>

              <div className="tower-decision__choices">
                {currentBatchTowers.map(towerId => {
                  const tower = gameStateRef.current.towers.find(candidate => candidate.id === towerId)
                  if (!tower?.gemType) return null

                  const isSelected = tower.id === selectedTowerForDecision.id
                  const spriteUrl = getTowerSpriteUrl(tower)
                  return (
                    <button
                      key={tower.id}
                      type="button"
                      className={`tower-choice${isSelected ? ' tower-choice--selected' : ''}`}
                      onClick={() => setSelectedTowerForDecision(tower)}
                      aria-pressed={isSelected}
                      aria-label={`${getGemName(tower.gemType)} ${getLevelName(tower.level)}`}
                    >
                      {spriteUrl && <img src={spriteUrl} alt="" />}
                      <span>{getGemName(tower.gemType)}</span>
                    </button>
                  )
                })}
              </div>

              <div className="tower-decision__detail">
                {getTowerSpriteUrl(selectedTowerForDecision) && (
                  <img src={getTowerSpriteUrl(selectedTowerForDecision)!} alt="" />
                )}
                <div>
                  <strong>{getGemName(selectedTowerForDecision.gemType!)}</strong>
                  <span>{getLevelName(selectedTowerForDecision.level)}</span>
                  <small>
                    伤害 {selectedTowerForDecision.damage} · 范围 {selectedTowerForDecision.range} ·
                    攻速 {selectedTowerForDecision.attackSpeed}ms
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="tower-decision__confirm"
                onClick={() => handleFinalizeTowers(selectedTowerForDecision.id)}
              >
                保留此塔
              </button>
              <p className="tower-decision__hint">
                其余 {ECONOMY_CONFIG.towersPerRound - 1} 座塔会风化成障碍，敌人的路线将重新计算。
              </p>
            </section>
          )}
        </div>

        <BuildPanel
          wood={uiState.wood}
          gold={uiState.gold}
          placedCount={currentBatchTowers.length}
          gameStatus={uiState.gameStatus}
          currentWave={uiState.wave}
          onStartWave={handleStartWave}
          onPause={handlePause}
          onResume={handleResume}
          onReset={handleResetGame}
        />
      </div>
      
      {/* 合成对话框 */}
      {showSynthesisDialog && selectedTowerForSynthesisId && (
        <SynthesisDialog
          fieldTowers={gameStateRef.current.storedTowers}
          selectedTowerId={selectedTowerForSynthesisId}
          canSynthesize={canSynthesizeTowers(uiState.gameStatus)}
          onSynthesize={(id1, id2) => {
            console.log('尝试合成:', id1, id2)
            return synthesizeTowers(id1, id2, selectedTowerForSynthesisId)
          }}
          onSynthesizeSpecial={(specialType) => {  // 新增
            console.log('合成特殊塔:', specialType)
            return synthesizeSpecialTower(specialType, selectedTowerForSynthesisId)
          }}
          onClose={() => {
            setShowSynthesisDialog(false)
            setSelectedTowerForSynthesisId(null)
          }}
        />
      )}
      
      {/* 游戏状态提示 */}
      {uiState.gameStatus === 'game_over' && (
        <div className="game-result game-result--over">
          <h2>游戏结束!</h2>
          <p>矿坑生命归零,你坚持了 {uiState.wave} 波</p>
        </div>
      )}
      
      {uiState.gameStatus === 'victory' && (
        <div className="game-result game-result--victory">
          <h2>胜利!</h2>
          <p>恭喜你完成了所有12波!</p>
        </div>
      )}
    </div>
  )
}
