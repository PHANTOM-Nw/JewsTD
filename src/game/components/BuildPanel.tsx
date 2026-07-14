import React from 'react'
import { ECONOMY_CONFIG } from '../config/economy'
import type { GameStatus } from '../types/game'

interface BuildPanelProps {
  wood: number
  gold: number
  placedCount: number
  gameStatus: GameStatus
}

export const BuildPanel: React.FC<BuildPanelProps> = ({
  wood,
  gold,
  placedCount,
  gameStatus
}) => {
  return (
    <div className="build-panel" style={{
      padding: '15px',
      background: '#F5F5F5',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#333' }}>
        建造提示
      </h3>
      
      <div style={{
        padding: '15px',
        background: '#FFF9C4',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#666',
        lineHeight: '1.6'
      }}>
        {gameStatus === 'playing' || gameStatus === 'paused' ? (
          <p style={{ margin: '0', textAlign: 'center', fontWeight: 'bold', color: '#FF5722' }}>
            🎮 波次{gameStatus === 'paused' ? '已暂停' : '进行中'}，不能放置塔
          </p>
        ) : gameStatus === 'deciding' ? (
          <p style={{ margin: '0', textAlign: 'center', fontWeight: 'bold', color: '#7B1FA2' }}>
            请从本轮5座塔中选择1座保留
          </p>
        ) : gameStatus === 'ready' ? (
          <p style={{ margin: '0', textAlign: 'center', fontWeight: 'bold', color: '#2E7D32' }}>
            本轮已完成，可合成、清除障碍或开始波次
          </p>
        ) : gameStatus === 'game_over' || gameStatus === 'victory' ? (
          <p style={{ margin: '0', textAlign: 'center', fontWeight: 'bold', color: '#666' }}>
            本局已结束
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 10px 0' }}>
              💡 <strong>操作说明:</strong>
            </p>
            <ol style={{ margin: '0', paddingLeft: '20px' }}>
              <li>点击地图空地放置塔</li>
              <li>每次随机生成1个宝石</li>
              <li>共放置5次(消耗5木材)</li>
              <li>选择1个保留,其余变障碍</li>
              <li style={{ color: '#FF6B6B', fontWeight: 'bold' }}>
                ✨ 点击障碍物消耗{ECONOMY_CONFIG.obstacleRemovalGoldCost}金币删除
              </li>
              <li style={{ color: '#FFA726', fontWeight: 'bold' }}>✨ 合成后材料变障碍物</li>
            </ol>
          </>
        )}
      </div>
      
      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: wood > 0 ? '#E8F5E9' : '#FFEBEE',
        borderRadius: '4px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: wood > 0 ? '#2E7D32' : '#C62828' }}>
          {wood}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>剩余木材</div>
      </div>

      <div style={{
        marginTop: '10px',
        padding: '10px',
        background: gold >= ECONOMY_CONFIG.obstacleRemovalGoldCost ? '#FFF8E1' : '#F5F5F5',
        borderRadius: '4px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#F57F17' }}>
          {gold}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          清除障碍需 {ECONOMY_CONFIG.obstacleRemovalGoldCost} 金币
        </div>
      </div>
      
      {placedCount > 0 && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: '#E3F2FD',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1976D2' }}>
            {placedCount}/{ECONOMY_CONFIG.towersPerRound}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>已放置</div>
        </div>
      )}
    </div>
  )
}
