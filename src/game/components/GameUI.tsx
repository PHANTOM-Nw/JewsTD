import React, { useState } from 'react'
import { soundManager } from '../services/audio'
import { calculateUpgradeCost } from '../config/towers'
import { WAVES } from '../config/waves'
import type { GameStatus } from '../types/game'

interface GameUIProps {
  uiState: {
    wood: number
    gold: number
    mineHealth: number
    maxMineHealth: number
    wave: number
    gameStatus: GameStatus
    selectedGem: string | null
    canPlaceTowers: boolean
    gameLevel: number  // ✅ 新增: 游戏等级
  }
  onStartWave: () => void
  onPause: () => void
  onResume: () => void
  onUpgradeGameLevel?: () => void  // ✅ 新增: 升级游戏等级回调
  onResetGame: () => void
}

export const GameUI: React.FC<GameUIProps> = ({
  uiState,
  onStartWave,
  onPause,
  onResume,
  onUpgradeGameLevel,
  onResetGame
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true)
  const isPreparationPhase = uiState.gameStatus === 'building' || uiState.gameStatus === 'ready'
  
  const toggleSound = () => {
    const newState = !soundEnabled
    setSoundEnabled(newState)
    soundManager.setEnabled(newState)
  }
  
  return (
    <div className="game-ui">
      {/* 资源显示 */}
      <div className="game-ui__resources">
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>木材</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{uiState.wood}</div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>金币</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{uiState.gold}</div>
        </div>
      </div>
      
      {/* ✅ 新增: 游戏等级显示 */}
      <div className="game-ui__level">
        <div style={{ fontSize: '12px', color: '#666' }}>游戏等级</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#9C27B0' }}>
          Lv.{uiState.gameLevel}
        </div>
      </div>
      
      {/* ✅ 新增: 升级按钮 */}
      {onUpgradeGameLevel && (
        <button
          onClick={onUpgradeGameLevel}
          disabled={!isPreparationPhase || uiState.gold < calculateUpgradeCost(uiState.gameLevel)}
          style={{
            padding: '8px 15px',
            background: isPreparationPhase && uiState.gold >= calculateUpgradeCost(uiState.gameLevel) ? '#9C27B0' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isPreparationPhase && uiState.gold >= calculateUpgradeCost(uiState.gameLevel) ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          升级<br/>
          <span style={{ fontSize: '11px' }}>
            {calculateUpgradeCost(uiState.gameLevel)}
          </span>
        </button>
      )}
      
      {/* 分隔线 */}
      <div className="game-ui__divider" />
      
      {/* 矿坑生命 */}
      <div className="game-ui__stat">
        <div style={{ fontSize: '12px', opacity: 0.9 }}>矿坑生命</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {uiState.mineHealth}/{uiState.maxMineHealth}
        </div>
      </div>
      
      {/* 分隔线 */}
      <div className="game-ui__divider" />
      
      {/* 波次 */}
      <div className="game-ui__stat">
        <div style={{ fontSize: '12px', opacity: 0.9 }}>波次</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {uiState.wave}/{WAVES.length}
        </div>
      </div>
      
      {/* 分隔线 */}
      <div className="game-ui__divider" />
      
      {/* 控制按钮 */}
      <div className="game-ui__controls">
        {!uiState.canPlaceTowers && uiState.gameStatus === 'playing' && (
          <div style={{
            padding: '10px 20px',
            background: '#FF5722',
            color: 'white',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            🎮 波次进行中...
          </div>
        )}
        
        {uiState.gameStatus === 'building' && (
          <div style={{
            padding: '10px 16px',
            background: '#1976D2',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            请放置5座塔
          </div>
        )}

        {uiState.gameStatus === 'deciding' && (
          <div style={{
            padding: '10px 16px',
            background: '#7B1FA2',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            请选择1座保留
          </div>
        )}

        {uiState.gameStatus === 'ready' && (
          <button
            onClick={onStartWave}
            disabled={uiState.wave >= WAVES.length}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uiState.wave >= WAVES.length ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              opacity: uiState.wave >= WAVES.length ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (uiState.wave < WAVES.length) {
                e.currentTarget.style.background = '#45a049'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
              }
            }}
            onMouseLeave={(e) => {
              if (uiState.wave < WAVES.length) {
                e.currentTarget.style.background = '#4CAF50'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            开始第 {uiState.wave + 1} 波
          </button>
        )}
        
        {uiState.gameStatus === 'playing' && (
          <button
            onClick={onPause}
            style={{
              padding: '10px 20px',
              background: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#F57C00'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#FF9800'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            暂停
          </button>
        )}
        
        {uiState.gameStatus === 'paused' && (
          <button
            onClick={onResume}
            style={{
              padding: '10px 20px',
              background: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1976D2'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2196F3'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            继续
          </button>
        )}
        
        {(uiState.gameStatus === 'game_over' || uiState.gameStatus === 'victory') && (
          <button
            onClick={onResetGame}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            重新开始
          </button>
        )}
        
        {/* 音效开关按钮 */}
        <button
          onClick={toggleSound}
          style={{
            padding: '10px 15px',
            background: soundEnabled ? '#4CAF50' : '#9E9E9E',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
          title={soundEnabled ? '音效已开启' : '音效已关闭'}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {soundEnabled ? '🔊 音效开' : '🔇 音效关'}
        </button>
      </div>
    </div>
  )
}
