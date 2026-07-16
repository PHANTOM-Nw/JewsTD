import React, { useEffect } from 'react'
import { useGameEngine } from '../game/engine/useGameEngine'
import { MAP_CONFIG } from '../game/config/map'

/**
 * 游戏引擎测试组件
 * 
 * 用于测试useGameEngine Hook的基本功能
 */
export const GameEngineTest: React.FC = () => {
  const {
    uiState,
    gameStateRef,
    startWave,
    pause,
    resume,
    resetGame
  } = useGameEngine()

  // 初始化Canvas尺寸
  useEffect(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    if (canvas) {
      canvas.width = MAP_CONFIG.cols * MAP_CONFIG.cellSize
      canvas.height = MAP_CONFIG.rows * MAP_CONFIG.cellSize
    }
  }, [])

  return (
    <div style={{ padding: '20px' }}>
      <h1>麻将TD - 游戏引擎测试</h1>
      
      {/* UI状态显示 */}
      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <h3>游戏状态</h3>
        <p>剩余建造: {uiState.wood} 次</p>
        <p>金币: {uiState.gold}</p>
        <p>矿坑生命: {uiState.mineHealth} / {uiState.maxMineHealth}</p>
        <p>波次: {uiState.wave}</p>
        <p>状态: {uiState.gameStatus}</p>
        <p>牌池: {uiState.mahjongPoolCount}</p>
        <p>本轮可用牌: {uiState.roundTiles.length}</p>
        <p>手牌花色: {uiState.heldTileSuit || '无'}</p>
        <p>功能牌数量: {uiState.functionTiles.length}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>波次控制</h3>
        <button onClick={startWave} style={{ marginRight: '10px' }}>
          开始下一波
        </button>
        <button onClick={pause} style={{ marginRight: '10px' }}>
          暂停
        </button>
        <button onClick={resume} style={{ marginRight: '10px' }}>
          继续
        </button>
        <button onClick={resetGame}>
          重置
        </button>
      </div>

      {/* 游戏画布 */}
      <div style={{ border: '2px solid #333', display: 'inline-block' }}>
        <canvas id="game-canvas" />
      </div>

      {/* 调试信息 */}
      <div style={{ marginTop: '20px', padding: '10px', background: '#e0e0e0' }}>
        <h3>调试信息</h3>
        <p>敌人数量: {gameStateRef.current.enemies.length}</p>
        <p>塔数量: {gameStateRef.current.towers.length}</p>
        <p>子弹数量: {gameStateRef.current.bullets.length}</p>
        <p>存储塔数量: {gameStateRef.current.storedTowerIds.length}</p>
      </div>
    </div>
  )
}
