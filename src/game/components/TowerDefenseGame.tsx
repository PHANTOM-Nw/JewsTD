import React, { useCallback, useEffect, useState } from 'react'
import { useGameEngine } from '../engine/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel } from './BuildPanel'
import { MahjongTile } from './MahjongTile'
import { WaveCompletionNotice } from './WaveCompletionNotice'
import type { Tower } from '../types/game'
import { getMahjongTileName } from '../config/mahjong'
import { MAP_CONFIG } from '../config/map'
import { ECONOMY_CONFIG } from '../config/economy'
import { screenPointToGrid } from './canvasPointer'
import './TowerDefenseGame.css'

interface ActiveTileDrag {
  tileId: string
  pointerId: number
}

export const TowerDefenseGame: React.FC = () => {
  const {
    uiState,
    gameStateRef,
    selectRoundTile,
    previewTowerPlacement,
    clearPlacementPreview,
    placeTower,
    finalizeTowers,
    revealMahjongHandSuits,
    keepMahjongHand,
    gambleForMahjongHonor,
    startWave,
    pause,
    resume,
    resetGame
  } = useGameEngine()

  const [currentBatchTowers, setCurrentBatchTowers] = useState<string[]>([])
  const [selectedTowerForDecision, setSelectedTowerForDecision] = useState<Tower | null>(null)
  const [activeTileDrag, setActiveTileDrag] = useState<ActiveTileDrag | null>(null)

  const clientPointToGrid = useCallback((clientX: number, clientY: number) => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return screenPointToGrid(
      clientX,
      clientY,
      {
        left: rect.left + canvas.clientLeft,
        top: rect.top + canvas.clientTop,
        width: canvas.clientWidth,
        height: canvas.clientHeight
      },
      MAP_CONFIG.cols * MAP_CONFIG.cellSize,
      MAP_CONFIG.rows * MAP_CONFIG.cellSize
    )
  }, [])

  const recordPlacedTower = useCallback((tower: Tower) => {
    setCurrentBatchTowers(previous => [...previous, tower.id])
    const batchIds = gameStateRef.current.currentBatchTowerIds
    if (batchIds.length >= ECONOMY_CONFIG.towersPerRound) {
      const firstTower = gameStateRef.current.towers.find(candidate => candidate.id === batchIds[0])
      if (firstTower) setSelectedTowerForDecision(firstTower)
    }
  }, [gameStateRef])

  useEffect(() => {
    if (!activeTileDrag) return

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activeTileDrag.pointerId) return
      event.preventDefault()
      const gridPosition = clientPointToGrid(event.clientX, event.clientY)
      if (gridPosition) previewTowerPlacement(gridPosition, activeTileDrag.tileId)
      else clearPlacementPreview()
    }

    const finishDrag = (event: PointerEvent, cancelled: boolean) => {
      if (event.pointerId !== activeTileDrag.pointerId) return
      const gridPosition = cancelled ? null : clientPointToGrid(event.clientX, event.clientY)
      clearPlacementPreview()
      if (gridPosition) {
        const tower = placeTower(gridPosition, activeTileDrag.tileId)
        if (tower) recordPlacedTower(tower)
      }
      setActiveTileDrag(null)
      selectRoundTile(null)
    }

    const handlePointerUp = (event: PointerEvent) => finishDrag(event, false)
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, true)
    const handleWindowBlur = () => {
      clearPlacementPreview()
      setActiveTileDrag(null)
      selectRoundTile(null)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [
    activeTileDrag,
    clearPlacementPreview,
    clientPointToGrid,
    placeTower,
    previewTowerPlacement,
    recordPlacedTower,
    selectRoundTile
  ])

  const beginTileDrag = (tileId: string, pointerId: number) => {
    if (uiState.gameStatus !== 'building' || !selectRoundTile(tileId)) return
    setActiveTileDrag({ tileId, pointerId })
  }

  const handleCanvasClick = useCallback((gridPos: { row: number; col: number }) => {
    const { grid, towers } = gameStateRef.current
    const cell = grid[gridPos.row]?.[gridPos.col]
    if (!cell) return

    if (cell.type === 'tower') {
      const existingTower = towers.find(tower => tower.id === cell.towerId)
      if (
        existingTower
        && uiState.gameStatus === 'deciding'
        && gameStateRef.current.currentBatchTowerIds.includes(existingTower.id)
      ) {
        setSelectedTowerForDecision(existingTower)
      }
      return
    }

  }, [gameStateRef, uiState.gameStatus])

  const handleFinalizeTowers = (keepTowerId: string) => {
    if (finalizeTowers(keepTowerId)) {
      setCurrentBatchTowers([])
      setSelectedTowerForDecision(null)
    }
  }

  const handleResetGame = () => {
    resetGame()
    setCurrentBatchTowers([])
    setSelectedTowerForDecision(null)
    setActiveTileDrag(null)
  }

  return (
    <div className="game-shell">
      <h1 className="game-title">麻将TD</h1>

      <GameUI uiState={uiState} onResetGame={handleResetGame} />

      <WaveCompletionNotice gameStatus={uiState.gameStatus} currentWave={uiState.wave} />

      <div className="game-main">
        <div className="game-board">
          <GameCanvas onClick={handleCanvasClick} onPlacementPreviewEnd={clearPlacementPreview} />

          {uiState.gameStatus === 'deciding' && selectedTowerForDecision?.mahjongTile && (
            <section className="tower-decision" role="dialog" aria-modal="true" aria-labelledby="tower-decision-title">
              <span className="tower-decision__eyebrow">三选一</span>
              <h2 id="tower-decision-title">选择要激活的牌</h2>

              <div className="tower-decision__choices">
                {currentBatchTowers.map(towerId => {
                  const tower = gameStateRef.current.towers.find(candidate => candidate.id === towerId)
                  if (!tower?.mahjongTile) return null
                  const isSelected = tower.id === selectedTowerForDecision.id
                  const name = getMahjongTileName(tower.mahjongTile)
                  return (
                    <button
                      key={tower.id}
                      type="button"
                      className={`tower-choice${isSelected ? ' tower-choice--selected' : ''}`}
                      onClick={() => setSelectedTowerForDecision(tower)}
                      aria-pressed={isSelected}
                      aria-label={`选择${name}作为激活牌`}
                    >
                      <MahjongTile tile={tower.mahjongTile} compact />
                      <span>{name}</span>
                    </button>
                  )
                })}
              </div>

              <div className="tower-decision__detail">
                <MahjongTile tile={selectedTowerForDecision.mahjongTile} />
                <div>
                  <strong>{getMahjongTileName(selectedTowerForDecision.mahjongTile)}</strong>
                  <span>激活后保留在场上</span>
                  <small>基础伤害 {selectedTowerForDecision.damage} · 范围 {selectedTowerForDecision.range} · 攻速 {selectedTowerForDecision.attackSpeed}ms</small>
                </div>
              </div>

              <button type="button" className="tower-decision__confirm" onClick={() => handleFinalizeTowers(selectedTowerForDecision.id)}>
                激活此牌
              </button>
              <p className="tower-decision__hint">其余 2 张保留完整牌面并原地成为牌墙，继续改变敌人路线。</p>
            </section>
          )}
        </div>

        <BuildPanel
          wood={uiState.wood}
          gold={uiState.gold}
          placedCount={currentBatchTowers.length}
          gameStatus={uiState.gameStatus}
          roundTiles={uiState.roundTiles}
          heldTileSuit={uiState.heldTileSuit}
          functionTiles={uiState.functionTiles}
          canGambleForHonor={uiState.canGambleForHonor}
          lastHonorGamble={uiState.lastHonorGamble}
          currentWave={uiState.wave}
          onTilePointerDown={beginTileDrag}
          onRevealHandSuits={revealMahjongHandSuits}
          onKeepHand={keepMahjongHand}
          onGambleForHonor={gambleForMahjongHonor}
          onStartWave={startWave}
          onPause={pause}
          onResume={resume}
          onReset={handleResetGame}
        />
      </div>

      {uiState.gameStatus === 'game_over' && (
        <div className="game-result game-result--over">
          <h2>游戏结束!</h2>
          <p>矿坑生命归零,你坚持了 {uiState.wave} 波</p>
        </div>
      )}

      {uiState.gameStatus === 'victory' && (
        <div className="game-result game-result--victory">
          <h2>胜利!</h2>
          <p>恭喜你完成了全部 12 波!</p>
        </div>
      )}
    </div>
  )
}
