import { useMemo, useState } from 'react'
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
  MahjongRank,
  Tower
} from '../types/game'
import {
  getAvailableMahjongSynthesisOptions,
  getMahjongAbilitySummary,
  getMahjongPairRouteHint,
  getMahjongStateFinalStats,
  submitMahjongSynthesis,
  type MahjongSynthesisTargetFormation,
  type MahjongSynthesisSubmitRequest,
  type MahjongSynthesisSubmitResult
} from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'
import { useDialogFocus } from './useDialogFocus'

type TargetFormation = MahjongSynthesisTargetFormation

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
  const synthesisOptions = useMemo(() => getAvailableMahjongSynthesisOptions({
    gameStatus,
    anchorTower,
    fieldTowers,
    walls,
    availableWhiteCount
  }), [
    anchorTower,
    availableWhiteCount,
    fieldTowers,
    gameStatus,
    walls
  ])
  const availableFormations = (Object.keys(FORMATION_LABELS) as TargetFormation[])
    .filter(candidate => synthesisOptions.some(option => (
      option.recipe.formation === candidate
    )))
  const availableChowStarts = synthesisOptions.flatMap(option => (
    option.recipe.formation === 'chow' ? [option.recipe.ranks[0]] : []
  )).filter((start, index, starts) => starts.indexOf(start) === index)
  const [requestedFormation, setFormation] = useState<TargetFormation>(
    initialSelection?.formation ?? availableFormations[0] ?? 'pair'
  )
  const formation = availableFormations.includes(requestedFormation)
    ? requestedFormation
    : availableFormations[0] ?? requestedFormation
  const [requestedChowStart, setChowStart] = useState<MahjongRank>(
    initialSelection?.chowStart ?? availableChowStarts[0] ?? 1
  )
  const chowStart = availableChowStarts.includes(requestedChowStart)
    ? requestedChowStart
    : availableChowStarts[0] ?? requestedChowStart
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

  const recipe = createRecipe(formation, chowStart)
  const currentOptions = synthesisOptions.filter(option => (
    option.recipe.formation === formation
      && (
        option.recipe.formation !== 'chow'
          || option.recipe.ranks[0] === chowStart
      )
  ))
  const availableTowerIds = new Set(currentOptions.flatMap(option => (
    option.materialTowerIds
  )))
  const availableWallKeys = new Set(currentOptions.flatMap(option => (
    option.wallPosition ? [positionKey(option.wallPosition)] : []
  )))
  const materialTowers = fieldTowers.filter(tower => availableTowerIds.has(tower.id))
  const materialWalls = walls.filter(wall => availableWallKeys.has(positionKey(wall)))
  const selectedTowers = materialTowers.filter(tower => selectedTowerIds.includes(tower.id))
  const selectedWall = materialWalls.find(wall => positionKey(wall) === selectedWallKey)
  const canUseWhite = currentOptions.some(option => option.useWhite)
  const selectedUseWhite = useWhite && canUseWhite

  const preview = useMemo(() => planMahjongSynthesis({
    gameStatus,
    anchor: anchorTower,
    materials: [
      ...selectedTowers.map(tower => ({ kind: 'tower' as const, tower })),
      ...(selectedWall ? [{ kind: 'wall' as const, wall: selectedWall }] : [])
    ],
    recipe,
    whiteCount: selectedUseWhite ? 1 : 0,
    availableWhiteCount
  }), [
    anchorTower,
    availableWhiteCount,
    gameStatus,
    recipe,
    selectedTowers,
    selectedWall,
    selectedUseWhite
  ])

  const chooseFormation = (nextFormation: TargetFormation) => {
    setFormation(nextFormation)
    setSelectedTowerIds([])
    setSelectedWallKey(null)
    setUseWhite(false)
    setSubmissionMessage('')
  }

  const chooseChowStart = (nextStart: MahjongRank) => {
    setChowStart(nextStart)
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
      materialTowerIds: selectedTowers.map(tower => tower.id),
      wallPositions: selectedWall
        ? [{ row: selectedWall.row, col: selectedWall.col }]
        : [],
      recipe,
      useWhite: selectedUseWhite
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
          <legend>当前可合成路线</legend>
          {availableFormations.length === 0 ? (
            <p className="synthesis-empty">当前棋子、牌墙与白无法完成任何合成。</p>
          ) : (
            <div>
              {availableFormations.map(candidate => (
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
          )}
        </fieldset>

        {formation === 'chow' && (
          <fieldset className="mahjong-synthesis__chow">
            <legend>选择连续点数</legend>
            <div>
              {availableChowStarts.map(start => {
                const ranks = toChowRanks(start)
                return (
                  <button
                    key={start}
                    type="button"
                    aria-pressed={chowStart === start}
                    onClick={() => chooseChowStart(start)}
                  >
                    {ranks.join('、')}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {materialTowers.length > 0 && (
          <section className="synthesis-section" aria-labelledby="active-material-title">
            <h3 id="active-material-title">选择具体主动棋子</h3>
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
          </section>
        )}

        {materialWalls.length > 0 && (
          <section className="synthesis-section" aria-labelledby="wall-material-title">
            <h3 id="wall-material-title">选择具体普通牌墙</h3>
            <div className="mahjong-synthesis__walls">
              {materialWalls.map(wall => {
                const selected = selectedWallKey === positionKey(wall)
                const label = getMahjongTileName(wall.mahjongTile!)
                return (
                  <button
                    key={positionKey(wall)}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${selected ? '取消' : '选择'}牌墙材料${label}，${formatPosition(wall)}`}
                    onClick={() => toggleWall(wall)}
                  >
                    <MahjongTile tile={wall.mahjongTile!} compact />
                    <span>{label}</span>
                    <small>吸收牌面后原格变纯墙</small>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {canUseWhite && (
          <label className="mahjong-synthesis__white">
            <input
              type="checkbox"
              checked={selectedUseWhite}
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
