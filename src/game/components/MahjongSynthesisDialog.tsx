import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckIcon,
  HammerIcon,
  XIcon
} from '@phosphor-icons/react'
import {
  getMahjongTileName,
  MAHJONG_HONOR_LABELS
} from '../config/mahjong'
import {
  planMahjongSynthesis,
  type MahjongSynthesisFailure,
  type MahjongSynthesisRecipe
} from '../engine/mahjongSynthesis'
import type {
  GameStatus,
  GridCell,
  MahjongFormation,
  MahjongRank,
  Tower
} from '../types/game'
import {
  getMahjongAbilitySummary,
  getMahjongPairRouteHint,
  getMahjongStateFinalStats,
  submitMahjongSynthesis,
  type MahjongSynthesisSubmitRequest,
  type MahjongSynthesisSubmitResult
} from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'

type TargetFormation = Exclude<MahjongFormation, 'single'>

interface MahjongSynthesisDialogProps {
  gameStatus: GameStatus
  anchorTower: Tower
  fieldTowers: readonly Tower[]
  walls: readonly GridCell[]
  availableWhiteCount: number
  initialSelection?: {
    formation?: TargetFormation
    chowStart?: MahjongRank
    materialTowerIds?: string[]
    wallPosition?: { row: number; col: number }
    useWhite?: boolean
  }
  onConfirm: (request: MahjongSynthesisSubmitRequest) => MahjongSynthesisSubmitResult
  onClose: () => void
}

const FORMATION_LABELS: Record<TargetFormation, string> = {
  pair: '对子',
  chow: '吃（顺子）',
  pung: '碰（明刻）',
  kong: '杠'
}

const FAILURE_MESSAGES: Record<MahjongSynthesisFailure, string> = {
  invalid_phase: '当前阶段不能合成。',
  invalid_anchor: '锚点棋子状态无效。',
  invalid_entity_state: '所选材料的实体或属性状态无效。',
  duplicate_material: '同一棋子或位置不能重复作为材料。',
  terminal_formation: '顺子或杠已经是终点形态。',
  too_many_walls: '一次吃或碰最多使用一张普通牌墙。',
  invalid_wall: '纯墙体不能作为牌面材料。',
  wall_not_allowed: '对子和杠不能使用牌墙。',
  too_many_white: '一次合成最多使用一张白。',
  white_unavailable: '功能牌区没有可用的白。',
  white_not_allowed: '白只能用于吃或碰。',
  invalid_material_count: '请继续选择配方需要的具体材料。',
  invalid_face: '所选材料的花色或点数不符合配方。',
  invalid_chow: '吃必须选择同花色连续三点。',
  invalid_route: '当前形态不能通过这组材料成长为所选产物。'
}

function positionKey(position: Pick<GridCell, 'row' | 'col'>): string {
  return `${position.row}:${position.col}`
}

function formatPosition(position: { row: number; col: number }): string {
  return `${position.row + 1}行${position.col + 1}列`
}

function getChowStarts(rank: MahjongRank): MahjongRank[] {
  return ([1, 2, 3, 4, 5, 6, 7] as const).filter(start => (
    rank >= start && rank <= start + 2
  ))
}

function toChowRanks(start: MahjongRank): readonly [MahjongRank, MahjongRank, MahjongRank] {
  return [start, (start + 1) as MahjongRank, (start + 2) as MahjongRank]
}

function createRecipe(
  formation: TargetFormation,
  chowStart: MahjongRank
): MahjongSynthesisRecipe {
  if (formation === 'chow') {
    return { formation, ranks: toChowRanks(chowStart) }
  }
  return { formation }
}

function useDialogFocus(onClose: () => void) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [onClose])

  return { dialogRef, closeButtonRef }
}

export function MahjongSynthesisDialog({
  gameStatus,
  anchorTower,
  fieldTowers,
  walls,
  availableWhiteCount,
  initialSelection,
  onConfirm,
  onClose
}: MahjongSynthesisDialogProps) {
  const [formation, setFormation] = useState<TargetFormation>(
    initialSelection?.formation ?? 'pair'
  )
  const chowStarts = anchorTower.mahjongTile
    ? getChowStarts(anchorTower.mahjongTile.rank)
    : [1 as MahjongRank]
  const [chowStart, setChowStart] = useState<MahjongRank>(
    initialSelection?.chowStart ?? chowStarts[0]
  )
  const [selectedTowerIds, setSelectedTowerIds] = useState<string[]>(
    initialSelection?.materialTowerIds ?? []
  )
  const [selectedWallKey, setSelectedWallKey] = useState<string | null>(
    initialSelection?.wallPosition
      ? positionKey(initialSelection.wallPosition)
      : null
  )
  const [useWhite, setUseWhite] = useState(initialSelection?.useWhite ?? false)
  const [submissionMessage, setSubmissionMessage] = useState('')
  const { dialogRef, closeButtonRef } = useDialogFocus(onClose)

  const materialTowers = fieldTowers.filter(tower => (
    tower.id !== anchorTower.id && tower.mahjongTile && tower.mahjongState
  ))
  const materialWalls = walls.filter(wall => wall.type === 'obstacle')
  const selectedTowers = materialTowers.filter(tower => selectedTowerIds.includes(tower.id))
  const selectedWall = materialWalls.find(wall => positionKey(wall) === selectedWallKey)
  const recipe = createRecipe(formation, chowStart)

  const preview = useMemo(() => planMahjongSynthesis({
    gameStatus,
    anchor: anchorTower,
    materials: [
      ...selectedTowers.map(tower => ({ kind: 'tower' as const, tower })),
      ...(selectedWall ? [{ kind: 'wall' as const, wall: selectedWall }] : [])
    ],
    recipe,
    whiteCount: useWhite ? 1 : 0,
    availableWhiteCount
  }), [
    anchorTower,
    availableWhiteCount,
    gameStatus,
    recipe,
    selectedTowers,
    selectedWall,
    useWhite
  ])

  const chooseFormation = (nextFormation: TargetFormation) => {
    setFormation(nextFormation)
    setSelectedTowerIds([])
    setSelectedWallKey(null)
    setUseWhite(false)
    setSubmissionMessage('')
  }

  const toggleTower = (towerId: string) => {
    setSelectedTowerIds(current => current.includes(towerId)
      ? current.filter(id => id !== towerId)
      : [...current, towerId])
    setSubmissionMessage('')
  }

  const toggleWall = (wall: GridCell) => {
    const key = positionKey(wall)
    setSelectedWallKey(current => current === key ? null : key)
    setSubmissionMessage('')
  }

  const submit = () => {
    if (!preview.ok) {
      setSubmissionMessage(FAILURE_MESSAGES[preview.reason])
      return
    }

    const result = submitMahjongSynthesis({
      anchorTowerId: anchorTower.id,
      materialTowerIds: selectedTowerIds,
      wallPositions: selectedWall
        ? [{ row: selectedWall.row, col: selectedWall.col }]
        : [],
      recipe,
      useWhite
    }, onConfirm, onClose)
    if (!result.ok) setSubmissionMessage(FAILURE_MESSAGES[result.reason])
  }

  const anchorName = anchorTower.mahjongTile
    ? getMahjongTileName(anchorTower.mahjongTile)
    : '未知棋子'
  const anchorPairHint = anchorTower.mahjongState
    ? getMahjongPairRouteHint(anchorTower.mahjongState)
    : null

  return (
    <div className="synthesis-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="synthesis-dialog mahjong-synthesis-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mahjong-synthesis-title"
      >
        <header className="synthesis-dialog__header">
          <h2 id="mahjong-synthesis-title"><HammerIcon weight="fill" />麻将合成工作台</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="关闭麻将合成工作台"
          >
            <XIcon weight="bold" />
          </button>
        </header>

        <div className="synthesis-dialog__anchor">
          {anchorTower.mahjongTile && <MahjongTile tile={anchorTower.mahjongTile} compact />}
          <span>
            锚点棋子
            <strong>{anchorName}</strong>
            <small>{formatPosition(anchorTower.gridPosition)}；产物固定保留在这里</small>
          </span>
        </div>
        {anchorPairHint && (
          <p className="mahjong-synthesis__pair-hint">{anchorPairHint}</p>
        )}

        <fieldset className="mahjong-synthesis__routes">
          <legend>1. 选择路线</legend>
          <div>
            {(Object.keys(FORMATION_LABELS) as TargetFormation[]).map(candidate => (
              <button
                key={candidate}
                type="button"
                aria-pressed={formation === candidate}
                onClick={() => chooseFormation(candidate)}
              >
                {FORMATION_LABELS[candidate]}
              </button>
            ))}
          </div>
        </fieldset>

        {formation === 'chow' && (
          <fieldset className="mahjong-synthesis__chow">
            <legend>选择连续点数</legend>
            <div>
              {chowStarts.map(start => {
                const ranks = toChowRanks(start)
                return (
                  <button
                    key={start}
                    type="button"
                    aria-pressed={chowStart === start}
                    onClick={() => setChowStart(start)}
                  >
                    {ranks.join('、')}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        <section className="synthesis-section" aria-labelledby="active-material-title">
          <h3 id="active-material-title">2. 选择具体主动棋子</h3>
          {materialTowers.length === 0 ? (
            <p className="synthesis-empty">场上暂无其他可选主动棋子。</p>
          ) : (
            <div className="mahjong-synthesis__materials">
              {materialTowers.map(tower => {
                const selected = selectedTowerIds.includes(tower.id)
                const name = getMahjongTileName(tower.mahjongTile!)
                return (
                  <button
                    key={tower.id}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${selected ? '取消' : '选择'}主动材料${name}，${formatPosition(tower.gridPosition)}`}
                    onClick={() => toggleTower(tower.id)}
                  >
                    <MahjongTile tile={tower.mahjongTile!} compact />
                    <span>{name}</span>
                    <small>{formatPosition(tower.gridPosition)}</small>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="synthesis-section" aria-labelledby="wall-material-title">
          <h3 id="wall-material-title">3. 可选普通牌墙材料</h3>
          {materialWalls.length === 0 ? (
            <p className="synthesis-empty">地图上没有牌墙。</p>
          ) : (
            <div className="mahjong-synthesis__walls">
              {materialWalls.map(wall => {
                const isTileWall = wall.mahjongWallKind === 'tile' && wall.mahjongTile
                const selected = selectedWallKey === positionKey(wall)
                const label = isTileWall ? getMahjongTileName(wall.mahjongTile!) : '纯墙体'
                return (
                  <button
                    key={positionKey(wall)}
                    type="button"
                    disabled={!isTileWall || formation === 'pair' || formation === 'kong'}
                    aria-pressed={selected}
                    aria-label={isTileWall
                      ? `${selected ? '取消' : '选择'}牌墙材料${label}，${formatPosition(wall)}`
                      : `纯墙体，${formatPosition(wall)}，不含数牌，不能作为材料`}
                    onClick={() => toggleWall(wall)}
                  >
                    {isTileWall && <MahjongTile tile={wall.mahjongTile!} compact />}
                    <span>{label}</span>
                    <small>{isTileWall ? '吸收牌面后原格变纯墙' : '不能参与合成'}</small>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {(formation === 'chow' || formation === 'pung') && (
          <label className="mahjong-synthesis__white">
            <input
              type="checkbox"
              checked={useWhite}
              disabled={availableWhiteCount === 0}
              onChange={event => setUseWhite(event.currentTarget.checked)}
            />
            <MahjongTile honor="white" compact />
            <span>
              使用 1 张白替代缺牌
              <small>功能牌区现有 {availableWhiteCount} 张；确认成功后才消耗</small>
            </span>
          </label>
        )}

        <section className="mahjong-synthesis__preview" aria-labelledby="synthesis-preview-title">
          <h3 id="synthesis-preview-title">产物预览</h3>
          {preview.ok ? (() => {
            const resultState = preview.plan.resultState
            const stats = getMahjongStateFinalStats(resultState)
            const abilitySummary = getMahjongAbilitySummary(resultState)
            const pairHint = getMahjongPairRouteHint(resultState)
            return (
              <div>
                <strong>{FORMATION_LABELS[resultState.formation as TargetFormation]}</strong>
                <span>伤害 {stats.damage.toFixed(1)}</span>
                <span>攻击间隔 {stats.attackIntervalMs.toFixed(0)}ms</span>
                <span>攻击距离 {stats.attackRange.toFixed(1)}</span>
                <span>
                  继承：{resultState.attachments.length > 0
                    ? resultState.attachments.map(item => MAHJONG_HONOR_LABELS[item]).join('、')
                    : '无中发附着'}
                </span>
                <span>消耗主动棋子 {preview.plan.consumedTowerIds.length} 座</span>
                <span>
                  变为纯墙：{preview.plan.pureWallPositions.length > 0
                    ? preview.plan.pureWallPositions.map(formatPosition).join('、')
                    : '无'}
                </span>
                <section
                  className="mahjong-synthesis__abilities"
                  aria-label="产物完整能力"
                >
                  <b>完整能力</b>
                  <ul>
                    {abilitySummary.map(ability => <li key={ability}>{ability}</li>)}
                  </ul>
                </section>
                {pairHint && (
                  <p className="mahjong-synthesis__pair-hint">{pairHint}</p>
                )}
              </div>
            )
          })() : (
            <p>{FAILURE_MESSAGES[preview.reason]}</p>
          )}
        </section>

        <p className="mahjong-action-message" aria-live="polite">
          {submissionMessage}
        </p>

        <div className="mahjong-dialog__actions">
          <button type="button" onClick={onClose}>取消</button>
          <button
            type="button"
            className="synthesis-dialog__confirm"
            disabled={!preview.ok}
            onClick={submit}
          >
            <CheckIcon weight="bold" />确认合成
          </button>
        </div>
      </section>
    </div>
  )
}
