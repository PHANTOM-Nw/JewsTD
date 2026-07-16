import React, { useCallback, useEffect, useState } from 'react'
import { useGameEngine } from '../engine/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel } from './BuildPanel'
import { MahjongActivationDecision } from './MahjongActivationDecision'
import {
  getMahjongPairRouteHint,
  getMahjongTowerActionLabel,
  getMahjongTowerComparisonLabel
} from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'
import { MahjongSynthesisDialog } from './MahjongSynthesisDialog'
import { MahjongWallDetail } from './MahjongWallDetail'
import { WaveCompletionNotice } from './WaveCompletionNotice'
import type { GridCell, MahjongAttachment, Tower } from '../types/game'
import {
  getMahjongTileName,
  MAHJONG_HONOR_LABELS
} from '../config/mahjong'
import { MAP_CONFIG } from '../config/map'
import { ECONOMY_CONFIG } from '../config/economy'
import { screenPointToGrid } from './canvasPointer'
import './TowerDefenseGame.css'

interface ActiveTileDrag {
  tileId: string
  pointerId: number
}

const ATTACHMENT_FAILURE_MESSAGES = {
  invalid_phase: '中、發只能在建造或备战阶段附着。',
  tower_not_found: '没有找到这座激活棋子。',
  honor_unavailable: '功能牌区没有这张牌。',
  already_attached: '这座棋子已经携带相同功能牌。',
  attachment_capacity: '当前形态没有更多中发附着容量。'
} as const

export const TowerDefenseGame: React.FC = () => {
  const {
    uiState,
    gameStateRef,
    selectRoundTile,
    previewTowerPlacement,
    clearPlacementPreview,
    placeTower,
    finalizeTowers,
    keepMahjongHand,
    gambleForMahjongHonor,
    synthesizeMahjong,
    attachMahjongHonor,
    removeMahjongWall,
    startWave,
    pause,
    resume,
    resetGame
  } = useGameEngine()

  const [currentBatchTowers, setCurrentBatchTowers] = useState<string[]>([])
  const [selectedTowerForDecision, setSelectedTowerForDecision] = useState<Tower | null>(null)
  const [activeTileDrag, setActiveTileDrag] = useState<ActiveTileDrag | null>(null)
  const [selectedSynthesisAnchor, setSelectedSynthesisAnchor] = useState<Tower | null>(null)
  const [selectedWall, setSelectedWall] = useState<GridCell | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<MahjongAttachment | null>(null)
  const [mahjongActionMessage, setMahjongActionMessage] = useState('')

  const activeTowers = gameStateRef.current.towers.filter(tower => (
    gameStateRef.current.storedTowerIds.includes(tower.id)
  ))
  const mahjongWalls = gameStateRef.current.grid.flat().filter(cell => (
    cell.type === 'obstacle'
    && (cell.mahjongWallKind === 'tile' || cell.mahjongWallKind === 'pure')
  ))
  const decisionTowers = currentBatchTowers
    .map(towerId => gameStateRef.current.towers.find(tower => tower.id === towerId))
    .filter((tower): tower is Tower => Boolean(tower?.mahjongTile))

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

  useEffect(() => {
    const preparation = uiState.gameStatus === 'building' || uiState.gameStatus === 'ready'
    if (!preparation) {
      setSelectedSynthesisAnchor(null)
      setSelectedWall(null)
    }
    if (!preparation) setPendingAttachment(null)
  }, [uiState.gameStatus])

  const beginTileDrag = (tileId: string, pointerId: number) => {
    if (uiState.gameStatus !== 'building' || !selectRoundTile(tileId)) return
    setActiveTileDrag({ tileId, pointerId })
  }

  const selectActiveTower = useCallback((tower: Tower) => {
    if (pendingAttachment) {
      const result = attachMahjongHonor(tower.id, pendingAttachment)
      if (result.ok) {
        setMahjongActionMessage(
          `${MAHJONG_HONOR_LABELS[pendingAttachment]}已附着到${tower.mahjongTile ? getMahjongTileName(tower.mahjongTile) : '棋子'}。`
        )
        setPendingAttachment(null)
      } else {
        setMahjongActionMessage(ATTACHMENT_FAILURE_MESSAGES[result.reason])
      }
      return
    }

    setSelectedWall(null)
    setSelectedSynthesisAnchor(tower)
    setMahjongActionMessage('')
  }, [attachMahjongHonor, pendingAttachment])

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
      } else if (
        existingTower
        && (uiState.gameStatus === 'building' || uiState.gameStatus === 'ready')
        && gameStateRef.current.storedTowerIds.includes(existingTower.id)
      ) {
        selectActiveTower(existingTower)
      }
      return
    }

    if (
      cell.type === 'obstacle'
      && (cell.mahjongWallKind === 'tile' || cell.mahjongWallKind === 'pure')
      && (uiState.gameStatus === 'building' || uiState.gameStatus === 'ready')
    ) {
      setSelectedSynthesisAnchor(null)
      setSelectedWall(cell)
      setMahjongActionMessage('')
    }
  }, [gameStateRef, selectActiveTower, uiState.gameStatus])

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
    setSelectedSynthesisAnchor(null)
    setSelectedWall(null)
    setPendingAttachment(null)
    setMahjongActionMessage('')
  }

  return (
    <div className="game-shell">
      <h1 className="game-title">麻将TD</h1>

      <GameUI uiState={uiState} onResetGame={handleResetGame} />

      <WaveCompletionNotice gameStatus={uiState.gameStatus} currentWave={uiState.wave} />

      <div className="game-main">
        <div className="game-board">
          <GameCanvas onClick={handleCanvasClick} onPlacementPreviewEnd={clearPlacementPreview} />

          {uiState.gameStatus === 'deciding' && selectedTowerForDecision && (
            <MahjongActivationDecision
              towers={decisionTowers}
              selectedTowerId={selectedTowerForDecision.id}
              onSelect={setSelectedTowerForDecision}
              onConfirm={handleFinalizeTowers}
            />
          )}
        </div>

        {(uiState.gameStatus === 'building' || uiState.gameStatus === 'ready') && (
          <details className="mahjong-board-access">
            <summary>地图棋子与墙体操作（键盘入口）</summary>
            <p className="mahjong-board-access__hint">
              {pendingAttachment
                ? `已选择${MAHJONG_HONOR_LABELS[pendingAttachment]}，请选择一座激活棋子。`
                : '选择激活棋子打开合成工作台；选择墙体查看拆除详情。'}
            </p>
            <div className="mahjong-board-access__group" role="group" aria-label="激活棋子">
              {activeTowers.length === 0 ? <span>暂无激活棋子</span> : activeTowers.map(tower => {
                if (!tower.mahjongTile) return null
                const name = getMahjongTileName(tower.mahjongTile)
                const comparison = getMahjongTowerComparisonLabel(tower)
                const pairHint = tower.mahjongState
                  ? getMahjongPairRouteHint(tower.mahjongState)
                  : null
                return (
                  <button
                    key={tower.id}
                    type="button"
                    onClick={() => selectActiveTower(tower)}
                    aria-label={getMahjongTowerActionLabel(tower, pendingAttachment)}
                  >
                    <MahjongTile tile={tower.mahjongTile} compact />
                    <span>{name}</span>
                    <small>{comparison}</small>
                    {pairHint && <small className="mahjong-board-access__pair-hint">{pairHint}</small>}
                  </button>
                )
              })}
            </div>
            <div className="mahjong-board-access__group" role="group" aria-label="牌墙和纯墙体">
              {mahjongWalls.length === 0 ? <span>暂无墙体</span> : mahjongWalls.map(wall => {
                const key = `${wall.row}:${wall.col}`
                const name = wall.mahjongWallKind === 'tile' && wall.mahjongTile
                  ? `${getMahjongTileName(wall.mahjongTile)}牌墙`
                  : '纯墙体'
                const cost = wall.mahjongWallKind === 'tile'
                  ? ECONOMY_CONFIG.mahjongTileWallRemovalGoldCost
                  : ECONOMY_CONFIG.mahjongPureWallRemovalGoldCost
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedSynthesisAnchor(null)
                      setSelectedWall(wall)
                      setMahjongActionMessage('')
                    }}
                    aria-label={`查看${name}，${wall.row + 1}行${wall.col + 1}列，拆除${cost}金币`}
                  >
                    {wall.mahjongTile
                      ? <MahjongTile tile={wall.mahjongTile} compact />
                      : <b aria-hidden="true">墙</b>}
                    <span>{name}</span>
                    <small>{wall.row + 1}行{wall.col + 1}列 · {cost}金币</small>
                  </button>
                )
              })}
            </div>
          </details>
        )}

        <p className="mahjong-action-message mahjong-action-message--global" aria-live="polite">
          {mahjongActionMessage}
        </p>

        <BuildPanel
          wood={uiState.wood}
          gold={uiState.gold}
          placedCount={currentBatchTowers.length}
          gameStatus={uiState.gameStatus}
          roundTiles={uiState.roundTiles}
          heldTileSuit={uiState.heldTileSuit}
          functionTiles={uiState.functionTiles}
          canGambleForHonor={uiState.canGambleForHonor}
          honorGambleChance={uiState.honorGambleChance}
          lastHonorGamble={uiState.lastHonorGamble}
          currentWave={uiState.wave}
          onTilePointerDown={beginTileDrag}
          onKeepHand={keepMahjongHand}
          onGambleForHonor={gambleForMahjongHonor}
          onSelectFunctionTile={attachment => {
            setPendingAttachment(attachment)
            setSelectedSynthesisAnchor(null)
            setSelectedWall(null)
            setMahjongActionMessage(
              `已选择${MAHJONG_HONOR_LABELS[attachment]}，请在地图或键盘列表中选择激活棋子。`
            )
          }}
          onStartWave={startWave}
          onPause={pause}
          onResume={resume}
          onReset={handleResetGame}
        />
      </div>

      {selectedSynthesisAnchor && (
        <MahjongSynthesisDialog
          gameStatus={uiState.gameStatus}
          anchorTower={selectedSynthesisAnchor}
          fieldTowers={activeTowers}
          walls={mahjongWalls}
          availableWhiteCount={uiState.functionTiles.filter(tile => tile === 'white').length}
          onConfirm={synthesizeMahjong}
          onClose={() => setSelectedSynthesisAnchor(null)}
        />
      )}

      {selectedWall && (
        <MahjongWallDetail
          wall={selectedWall}
          gold={uiState.gold}
          gameStatus={uiState.gameStatus}
          onRemove={removeMahjongWall}
          onClose={() => setSelectedWall(null)}
        />
      )}

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
