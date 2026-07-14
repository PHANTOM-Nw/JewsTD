import React, { useState, useCallback } from 'react'
import { useGameEngine } from '../engine/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel } from './BuildPanel'
import { SynthesisDialog } from './SynthesisDialog'
import { WaveCompletionNotice } from './WaveCompletionNotice'
import type { GemType, GemLevel, Tower } from '../types/game'
import { GEM_COLORS, GEM_NAMES, LEVEL_NAMES } from '../config/towers'
import { ECONOMY_CONFIG } from '../config/economy'
import { canInspectSynthesisFromTower, canSynthesizeTowers } from '../engine/gameFlow'
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

  // 辅助函数:获取宝石颜色
  const getGemColor = (gemType: GemType): string => {
    return GEM_COLORS[gemType]
  }

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
      
      // 如果已经放置了5个塔,自动进入决策模式
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
        onStartWave={handleStartWave}
        onPause={handlePause}
        onResume={handleResume}
        onUpgradeGameLevel={upgradeGameLevel}  // ✅ 新增
        onResetGame={handleResetGame}
      />

      <WaveCompletionNotice
        gameStatus={uiState.gameStatus}
        currentWave={uiState.wave}
      />
      
      {/* 游戏主体区域 */}
      <div className="game-main">
        {/* 左侧建造面板 */}
        <BuildPanel
          wood={uiState.wood}
          gold={uiState.gold}
          placedCount={currentBatchTowers.length}
          gameStatus={uiState.gameStatus}
        />
        
        {/* 中间Canvas */}
        <div className="game-board">
          <GameCanvas 
            onClick={handleCanvasClick} 
            currentPath={gameStateRef.current.currentPath}
          />
          
          {/* 决策对话框 */}
          {uiState.gameStatus === 'deciding' && selectedTowerForDecision && (
            <div className="tower-decision">
              <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#333' }}>
                选择要保留的塔
              </h3>

              <div style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
                marginBottom: '15px'
              }}>
                {currentBatchTowers.map(towerId => {
                  const tower = gameStateRef.current.towers.find(candidate => candidate.id === towerId)
                  if (!tower?.gemType) return null

                  const isSelected = tower.id === selectedTowerForDecision.id
                  return (
                    <button
                      key={tower.id}
                      onClick={() => setSelectedTowerForDecision(tower)}
                      title={`${getGemName(tower.gemType)} ${getLevelName(tower.level)}`}
                      style={{
                        width: '44px',
                        height: '44px',
                        background: getGemColor(tower.gemType),
                        border: isSelected ? '4px solid #2196F3' : '2px solid #666',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: tower.gemType === 'diamond' ? '#333' : 'white',
                        fontWeight: 'bold'
                      }}
                    >
                      {tower.level.substring(0, 1).toUpperCase()}
                    </button>
                  )
                })}
              </div>
              
              {/* 显示选中的塔信息 */}
              <div style={{
                padding: '15px',
                background: '#F5F5F5',
                borderRadius: '6px',
                marginBottom: '15px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {/* 塔的图标 */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    background: getGemColor(selectedTowerForDecision.gemType!),
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: 'white',
                    border: '3px solid #333'
                  }}>
                    {selectedTowerForDecision.level.substring(0, 1).toUpperCase()}
                  </div>
                  
                  {/* 塔的信息 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '5px' }}>
                      {getGemName(selectedTowerForDecision.gemType!)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      等级: {getLevelName(selectedTowerForDecision.level)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      伤害: {selectedTowerForDecision.damage} | 范围: {selectedTowerForDecision.range}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      攻击速度: {selectedTowerForDecision.attackSpeed}ms
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 */}
              <div style={{ display: 'flex' }}>
                <button
                  onClick={() => handleFinalizeTowers(selectedTowerForDecision.id)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                  }}
                >
                  ✓ 保留在场上
                </button>
              </div>
              
              <p style={{ 
                fontSize: '12px', 
                color: '#999', 
                marginTop: '10px',
                textAlign: 'center'
              }}>
                提示: 选择保留后,其余4个塔将变成障碍物
              </p>
            </div>
          )}
        </div>
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
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: '#FFEBEE',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#F44336', margin: '0 0 10px 0' }}>游戏结束!</h2>
          <p>矿坑生命归零,你坚持了 {uiState.wave} 波</p>
        </div>
      )}
      
      {uiState.gameStatus === 'victory' && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: '#E8F5E9',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#4CAF50', margin: '0 0 10px 0' }}>胜利!</h2>
          <p>恭喜你完成了所有12波!</p>
        </div>
      )}
    </div>
  )
}
