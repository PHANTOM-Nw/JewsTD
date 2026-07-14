import React, { useState, useCallback } from 'react'
import { useGameEngine } from '../engine/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel } from './BuildPanel'
import { SynthesisDialog } from './SynthesisDialog'
import type { GemType, GemLevel, Tower } from '../types/game'
import { GEM_COLORS, GEM_NAMES, LEVEL_NAMES } from '../config/towers'

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
    start,
    pause,
    resume
  } = useGameEngine()
  
  // 跟踪当前批次放置的塔
  const [currentBatchTowers, setCurrentBatchTowers] = useState<string[]>([])
  const [showDecisionDialog, setShowDecisionDialog] = useState(false)
  const [selectedTowerForDecision, setSelectedTowerForDecision] = useState<Tower | null>(null)
  const [showSynthesisDialog, setShowSynthesisDialog] = useState(false)

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
        
        if (isCurrentBatch) {
          if (currentBatchTowers.length >= 5) {
            setSelectedTowerForDecision(existingTower)
            setShowDecisionDialog(true)
          }
        } else {
          setShowSynthesisDialog(true)
        }
        
        return
      }
    }
    
    // ✅ 新增: 点击障碍物,消耗木材删除
    if (cell.type === 'obstacle') {
      if (uiState.wood <= 0) {
        console.warn('木材不足,无法删除障碍物')
        alert('需要1个木材才能删除障碍物!')
        return
      }
      
      removeObstacle(gridPos)
      return
    }
    
    // 点击空地,执行放置逻辑 - 现有逻辑保持不变
    if (uiState.gameStatus !== 'preparing') return
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
      if (currentBatchTowers.length + 1 >= 5) {
        setShowDecisionDialog(true)
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
    placeTower, 
    currentBatchTowers,
    gameStateRef,
    removeObstacle
  ])

  const handleFinalizeTowers = (keepTowerId: string) => {
    finalizeTowers(keepTowerId)
    setCurrentBatchTowers([])
    setShowDecisionDialog(false)
  }

  const handleStartWave = () => {
    startWave()
    start()
  }

  const handlePause = () => {
    pause()
  }

  const handleResume = () => {
    resume()
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ margin: '0 0 20px 0' }}>宝石TD</h1>
      
      {/* 顶部UI */}
      <GameUI
        uiState={uiState}
        onStartWave={handleStartWave}
        onPause={handlePause}
        onResume={handleResume}
        onOpenSynthesis={() => setShowSynthesisDialog(true)}
        onUpgradeGameLevel={upgradeGameLevel}  // ✅ 新增
      />
      
      {/* 游戏主体区域 */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        {/* 左侧建造面板 */}
        <BuildPanel
          wood={uiState.wood}
          placedCount={currentBatchTowers.length}
          canPlaceTowers={uiState.canPlaceTowers}
        />
        
        {/* 中间Canvas */}
        <div style={{ position: 'relative' }}>
          <GameCanvas 
            onClick={handleCanvasClick} 
            currentPath={gameStateRef.current.currentPath}
          />
          
          {/* 决策对话框 */}
          {showDecisionDialog && selectedTowerForDecision && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'white',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              zIndex: 100,
              minWidth: '300px'
            }}>
              <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#333' }}>
                选择要保留的塔
              </h3>
              
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
              <div style={{ display: 'flex', gap: '10px' }}>
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
                  ✓ 保留到存储区
                </button>
                
                <button
                  onClick={() => {
                    setShowDecisionDialog(false)
                    setSelectedTowerForDecision(null)
                  }}
                  style={{
                    padding: '12px 20px',
                    background: '#FF5722',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  取消
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
      {showSynthesisDialog && (
        <SynthesisDialog
          storedTowers={gameStateRef.current.storedTowers}
          onSynthesize={(id1, id2) => {
            console.log('尝试合成:', id1, id2)
            synthesizeTowers(id1, id2)
            setShowSynthesisDialog(false)
          }}
          onSynthesizeSpecial={(specialType) => {  // 新增
            console.log('合成特殊塔:', specialType)
            synthesizeSpecialTower(specialType)
            setShowSynthesisDialog(false)
          }}
          onClose={() => setShowSynthesisDialog(false)}
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
