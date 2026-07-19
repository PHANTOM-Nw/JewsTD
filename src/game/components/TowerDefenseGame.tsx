import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useGameEngine } from '../engine/useGameEngine'
import { GameCanvas } from './GameCanvas'
import { GameUI } from './GameUI'
import { BuildPanel, GamePhaseHint } from './BuildPanel'
import { MahjongActivationDecision } from './MahjongActivationDecision'
import { ATTACHMENT_FAILURE_MESSAGES } from './mahjongUiModel'
import { MahjongSynthesisDialog } from './MahjongSynthesisDialog'
import { MahjongWallDetail } from './MahjongWallDetail'
import { MahjongHonorDetail } from './MahjongHonorDetail'
import { MahjongHonorAttachmentConfirm } from './MahjongHonorAttachmentConfirm'
import { MahjongTowerInspection } from './MahjongTowerInspection'
import { WaveCompletionNotice } from './WaveCompletionNotice'
import type { GridCell, MahjongAttachment, MahjongHonor, Tower } from '../types/game'
import {
  getMahjongTileName,
  MAHJONG_HONOR_LABELS
} from '../config/mahjong'
import { MAP_CONFIG } from '../config/map'
import { ECONOMY_CONFIG } from '../config/economy'
import { getBoardCellOverlayStyle } from './boardOverlay'
import {
  canInspectTowerDuringStatus,
  getBoardClickIntent
} from './boardInteraction'
import { screenPointToGrid } from './canvasPointer'
import { useElementFullscreen } from './fullscreen'
import './TowerDefenseGame.css'

interface ActiveTileDrag {
  tileId: string
  pointerId: number
}

interface PendingAttachmentTarget {
  tower: Tower
  attachment: MahjongAttachment
}

export const TowerDefenseGame: React.FC = () => {
  const gameShellRef = useRef<HTMLDivElement>(null)
  const fullscreen = useElementFullscreen(gameShellRef)
  const {
    uiState,
    combatSpeed,
    gameStateRef,
    selectRoundTile,
    previewTowerPlacement,
    clearPlacementPreview,
    placeTower,
    finalizeTowers,
    keepMahjongHand,
    synthesizeMahjong,
    attachMahjongHonor,
    removeMahjongWall,
    startWave,
    pause,
    resume,
    cycleCombatSpeed,
    resetGame
  } = useGameEngine()

  const [currentBatchTowers, setCurrentBatchTowers] = useState<string[]>([])
  const [selectedTowerForDecision, setSelectedTowerForDecision] = useState<Tower | null>(null)
  const [decisionMinimized, setDecisionMinimized] = useState(false)
  const [activeTileDrag, setActiveTileDrag] = useState<ActiveTileDrag | null>(null)
  const [inspectedTowerId, setInspectedTowerId] = useState<string | null>(null)
  const [selectedSynthesisAnchor, setSelectedSynthesisAnchor] = useState<Tower | null>(null)
  const [selectedWall, setSelectedWall] = useState<GridCell | null>(null)
  const [pendingAttachment, setPendingAttachment] = useState<MahjongAttachment | null>(null)
  const [pendingAttachmentTarget, setPendingAttachmentTarget] = useState<PendingAttachmentTarget | null>(null)
  const [honorDetail, setHonorDetail] = useState<MahjongHonor | null>(null)
  const [mahjongActionMessage, setMahjongActionMessage] = useState('')

  const activeTowers = gameStateRef.current.towers.filter(tower => (
    gameStateRef.current.storedTowerIds.includes(tower.id)
  ))
  const inspectedTower = inspectedTowerId
    ? activeTowers.find(tower => tower.id === inspectedTowerId) ?? null
    : null
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
      setHonorDetail(null)
      setPendingAttachmentTarget(null)
    }
    if (!preparation) setPendingAttachment(null)
    if (!canInspectTowerDuringStatus(uiState.gameStatus)) {
      setInspectedTowerId(null)
    }
  }, [uiState.gameStatus])

  const beginTileDrag = (tileId: string, pointerId: number) => {
    if (uiState.gameStatus !== 'building' || !selectRoundTile(tileId)) return
    setActiveTileDrag({ tileId, pointerId })
  }

  const confirmPendingAttachment = useCallback(() => {
    if (!pendingAttachmentTarget) return
    const { tower, attachment } = pendingAttachmentTarget
    const result = attachMahjongHonor(tower.id, attachment)
    if (result.ok) {
      setMahjongActionMessage(
        `${MAHJONG_HONOR_LABELS[attachment]}已附着到${tower.mahjongTile ? getMahjongTileName(tower.mahjongTile) : '棋子'}。`
      )
      setPendingAttachment(null)
    } else {
      setMahjongActionMessage(ATTACHMENT_FAILURE_MESSAGES[result.reason])
    }
    setPendingAttachmentTarget(null)
  }, [attachMahjongHonor, pendingAttachmentTarget])

  const handleCanvasClick = useCallback((gridPos: { row: number; col: number }) => {
    const { grid, towers } = gameStateRef.current
    const cell = grid[gridPos.row]?.[gridPos.col]
    if (!cell) return
    const intent = getBoardClickIntent({
      gameStatus: uiState.gameStatus,
      cell,
      existingTowerIds: towers.map(tower => tower.id),
      storedTowerIds: gameStateRef.current.storedTowerIds,
      currentBatchTowerIds: gameStateRef.current.currentBatchTowerIds,
      inspectedTowerId,
      hasPendingAttachment: pendingAttachment !== null
    })

    if (intent.kind === 'select_decision_tower') {
      const tower = towers.find(candidate => candidate.id === intent.towerId)
      if (tower) setSelectedTowerForDecision(tower)
      return
    }

    if (intent.kind === 'inspect_tower') {
      const tower = towers.find(candidate => candidate.id === intent.towerId)
      if (!tower) return
      setInspectedTowerId(tower.id)
      setSelectedWall(null)
      setSelectedSynthesisAnchor(intent.openSynthesis ? tower : null)
      setMahjongActionMessage('')
      return
    }

    if (intent.kind === 'target_attachment' && pendingAttachment) {
      const tower = towers.find(candidate => candidate.id === intent.towerId)
      if (!tower) return
      setInspectedTowerId(tower.id)
      setSelectedWall(null)
      setSelectedSynthesisAnchor(null)
      setPendingAttachmentTarget({ tower, attachment: pendingAttachment })
      return
    }

    setInspectedTowerId(null)
    setSelectedSynthesisAnchor(null)
    setSelectedWall(intent.kind === 'open_wall' ? intent.wall : null)
    if (intent.kind === 'open_wall') setMahjongActionMessage('')
  }, [gameStateRef, inspectedTowerId, pendingAttachment, uiState.gameStatus])

  const handleFinalizeTowers = (keepTowerId: string) => {
    if (finalizeTowers(keepTowerId)) {
      setCurrentBatchTowers([])
      setSelectedTowerForDecision(null)
      setDecisionMinimized(false)
    }
  }

  const handleResetGame = () => {
    resetGame()
    setCurrentBatchTowers([])
    setSelectedTowerForDecision(null)
    setDecisionMinimized(false)
    setActiveTileDrag(null)
    setInspectedTowerId(null)
    setSelectedSynthesisAnchor(null)
    setSelectedWall(null)
    setPendingAttachment(null)
    setPendingAttachmentTarget(null)
    setHonorDetail(null)
    setMahjongActionMessage('')
  }

  return (
    <div className="game-shell" ref={gameShellRef}>
      <GameUI
        uiState={uiState}
        combatSpeed={combatSpeed}
        onCycleCombatSpeed={cycleCombatSpeed}
        onResetGame={handleResetGame}
        phaseHint={(
          <GamePhaseHint
            placedCount={currentBatchTowers.length}
            gameStatus={uiState.gameStatus}
            honorDrawScheduled={uiState.honorDrawScheduled}
          />
        )}
        fullscreen={{
          isSupported: fullscreen.isSupported,
          isFullscreen: fullscreen.isFullscreen,
          onToggle: fullscreen.toggleFullscreen
        }}
      />

      <div className="game-main">
        <div className="game-board">
          <GameCanvas onClick={handleCanvasClick} onPlacementPreviewEnd={clearPlacementPreview} />

          {inspectedTower && <MahjongTowerInspection tower={inspectedTower} />}

          <WaveCompletionNotice gameStatus={uiState.gameStatus} currentWave={uiState.wave} />

          {uiState.gameStatus === 'deciding' && selectedTowerForDecision && (
            <MahjongActivationDecision
              towers={decisionTowers}
              selectedTowerId={selectedTowerForDecision.id}
              minimized={decisionMinimized}
              onSelect={setSelectedTowerForDecision}
              onConfirm={handleFinalizeTowers}
              onToggleMinimized={() => setDecisionMinimized(v => !v)}
            />
          )}

          {uiState.gameStatus === 'deciding' && decisionMinimized && (
            <div className="game-board__overlay" aria-hidden="true">
              {decisionTowers.map(tower => (
                <div
                  key={tower.id}
                  className="board-cell-highlight"
                  style={getBoardCellOverlayStyle(tower.gridPosition)}
                />
              ))}
            </div>
          )}

          {selectedSynthesisAnchor && (
            <div className="game-board__overlay" aria-hidden="true">
              <div
                className="board-cell-highlight"
                style={getBoardCellOverlayStyle(selectedSynthesisAnchor.gridPosition)}
              />
            </div>
          )}

          <p className="mahjong-action-message--global" aria-live="polite">
            {mahjongActionMessage}
          </p>
        </div>

        <BuildPanel
          placedCount={currentBatchTowers.length}
          gameStatus={uiState.gameStatus}
          roundTiles={uiState.roundTiles}
          heldTileSuit={uiState.heldTileSuit}
          functionTiles={uiState.functionTiles}
          honorDrawScheduled={uiState.honorDrawScheduled}
          lastHonorDraw={uiState.lastHonorDraw}
          currentWave={uiState.wave}
          onTilePointerDown={beginTileDrag}
          onKeepHand={keepMahjongHand}
          onSelectFunctionTile={honor => {
            setInspectedTowerId(null)
            setSelectedSynthesisAnchor(null)
            setSelectedWall(null)
            if (honor === 'white') {
              setHonorDetail('white')
              return
            }
            setPendingAttachment(honor)
            setMahjongActionMessage(
              `已选择${MAHJONG_HONOR_LABELS[honor]}，请在地图或键盘列表中选择激活棋子。`
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
          key={selectedSynthesisAnchor.id}
          gameStatus={uiState.gameStatus}
          anchorTower={selectedSynthesisAnchor}
          fieldTowers={activeTowers}
          walls={mahjongWalls}
          availableWhiteCount={uiState.functionTiles.filter(tile => tile === 'white').length}
          onConfirm={synthesizeMahjong}
          onClose={() => {
            setSelectedSynthesisAnchor(null)
            setInspectedTowerId(null)
          }}
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

      {honorDetail && (
        <MahjongHonorDetail onClose={() => setHonorDetail(null)} />
      )}

      {pendingAttachmentTarget && (
        <MahjongHonorAttachmentConfirm
          tower={pendingAttachmentTarget.tower}
          attachment={pendingAttachmentTarget.attachment}
          onConfirm={confirmPendingAttachment}
          onClose={() => setPendingAttachmentTarget(null)}
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
