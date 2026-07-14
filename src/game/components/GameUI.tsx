import React, { useState } from 'react'
import { soundManager } from '../services/audio'
import { calculateUpgradeCost } from '../config/towers'

interface GameUIProps {
  uiState: {
    wood: number
    gold: number
    mineHealth: number
    maxMineHealth: number
    wave: number
    gameStatus: 'preparing' | 'playing' | 'paused' | 'game_over' | 'victory'
    selectedGem: string | null
    canPlaceTowers: boolean
    gameLevel: number  // ✅ 新增: 游戏等级
  }
  onStartWave: () => void
  onPause: () => void
  onResume: () => void
  onOpenSynthesis?: () => void
  onUpgradeGameLevel?: () => void  // ✅ 新增: 升级游戏等级回调
}

export const GameUI: React.FC<GameUIProps> = ({
  uiState,
  onStartWave,
  onPause,
  onResume,
  onOpenSynthesis,
  onUpgradeGameLevel
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true)
  
  const toggleSound = () => {
    const newState = !soundEnabled
    setSoundEnabled(newState)
    soundManager.setEnabled(newState)
  }
  
  return (
    <div style={{
      display: 'flex',
      gap: '30px',
      padding: '15px 20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '8px',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      alignItems: 'center'
    }}>
      {/* 资源显示 */}
      <div style={{ display: 'flex', gap: '20px' }}>
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
      <div style={{
        background: '#E1BEE7',
        padding: '8px 15px',
        borderRadius: '8px',
        marginRight: '10px'
      }}>
        <div style={{ fontSize: '12px', color: '#666' }}>游戏等级</div>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#9C27B0' }}>
          Lv.{uiState.gameLevel}
        </div>
      </div>
      
      {/* ✅ 新增: 升级按钮 */}
      {onUpgradeGameLevel && (
        <button
          onClick={onUpgradeGameLevel}
          disabled={uiState.gold < calculateUpgradeCost(uiState.gameLevel)}
          style={{
            padding: '8px 15px',
            background: uiState.gold >= calculateUpgradeCost(uiState.gameLevel) ? '#9C27B0' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: uiState.gold >= calculateUpgradeCost(uiState.gameLevel) ? 'pointer' : 'not-allowed',
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
      <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.3)' }} />
      
      {/* 矿坑生命 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', opacity: 0.9 }}>矿坑生命</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {uiState.mineHealth}/{uiState.maxMineHealth}
        </div>
      </div>
      
      {/* 分隔线 */}
      <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.3)' }} />
      
      {/* 波次 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '12px', opacity: 0.9 }}>波次</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {uiState.wave}/12
        </div>
      </div>
      
      {/* 分隔线 */}
      <div style={{ width: '2px', height: '40px', background: 'rgba(255,255,255,0.3)' }} />
      
      {/* 控制按钮 */}
      <div style={{ display: 'flex', gap: '10px' }}>
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
        
        {uiState.gameStatus === 'preparing' && (
          <button
            onClick={onStartWave}
            disabled={uiState.wave >= 12}
            style={{
              padding: '10px 20px',
              background: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: uiState.wave >= 12 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              opacity: uiState.wave >= 12 ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (uiState.wave < 12) {
                e.currentTarget.style.background = '#45a049'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
              }
            }}
            onMouseLeave={(e) => {
              if (uiState.wave < 12) {
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
        
        {/* 合成按钮 */}
        {onOpenSynthesis && (
          <button
            onClick={onOpenSynthesis}
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
            🔧 合成
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
