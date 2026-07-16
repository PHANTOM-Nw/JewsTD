import {
  getMahjongTileName,
  MAHJONG_ATTACHMENT_CAPACITY,
  MAHJONG_FORMATION_TILE_COUNTS,
  MAHJONG_FORMATION_MECHANICS,
  MAHJONG_GREEN_ATTACHMENT_CONFIG,
  MAHJONG_HONOR_LABELS,
  MAHJONG_RED_ATTACHMENT_CONFIG,
  MAHJONG_SUIT_COMBAT_CONFIG,
  MAHJONG_SUIT_LABELS,
  MAHJONG_WHITE_CATALYST_CONFIG
} from '../config/mahjong'
import {
  planMahjongSynthesis,
  type MahjongSynthesisFailure,
  type MahjongSynthesisRecipe
} from '../engine/mahjongSynthesis'
import { calculateMahjongFormationStats } from '../engine/mahjongStats'
import type { MahjongWallRemovalFailure } from '../engine/mahjongWalls'
import type {
  GameStatus,
  GridCell,
  MahjongAttachment,
  MahjongFormation,
  MahjongHonor,
  MahjongRandomStats,
  MahjongRank,
  MahjongTowerState,
  Tower
} from '../types/game'

export const MAHJONG_FORMATION_LABELS: Record<MahjongFormation, string> = {
  single: '单牌',
  pair: '对子',
  chow: '顺子',
  pung: '明刻',
  kong: '杠'
}

export type MahjongSynthesisTargetFormation = Exclude<MahjongFormation, 'single'>

export interface AvailableMahjongSynthesisOption {
  recipe: MahjongSynthesisRecipe
  materialTowerIds: string[]
  wallPosition: { row: number; col: number } | null
  useWhite: boolean
}

export interface MahjongSynthesisAvailabilityRequest {
  gameStatus: GameStatus
  anchorTower: Tower
  fieldTowers: readonly Tower[]
  walls: readonly GridCell[]
  availableWhiteCount: number
}

const CHOW_STARTS: readonly MahjongRank[] = [1, 2, 3, 4, 5, 6, 7]

const SYNTHESIS_RECIPES: readonly MahjongSynthesisRecipe[] = [
  { formation: 'pair' },
  ...CHOW_STARTS.map(start => ({
    formation: 'chow' as const,
    ranks: [
      start,
      (start + 1) as MahjongRank,
      (start + 2) as MahjongRank
    ] as const
  })),
  { formation: 'pung' },
  { formation: 'kong' }
]

function collectTowerMaterialSelections(towers: readonly Tower[]): Tower[][] {
  const selections: Tower[][] = []

  const visit = (
    index: number,
    selected: Tower[],
    selectedLogicalTileCount: number
  ) => {
    if (index === towers.length) {
      selections.push([...selected])
      return
    }

    visit(index + 1, selected, selectedLogicalTileCount)

    const tower = towers[index]
    const state = tower.mahjongState
    if (!state) return
    const nextLogicalTileCount = selectedLogicalTileCount
      + MAHJONG_FORMATION_TILE_COUNTS[state.formation]
    // Every target contains at most four logical tiles and the anchor always
    // contributes at least one. Larger selections can never pass the planner.
    if (nextLogicalTileCount > 3) return

    selected.push(tower)
    visit(index + 1, selected, nextLogicalTileCount)
    selected.pop()
  }

  visit(0, [], 0)
  return selections
}

/**
 * Enumerates exact, currently committable synthesis choices. The planner remains
 * the source of truth: the UI only publishes a route or material after at least
 * one complete combination has passed the same atomic validation as submission.
 */
export function getAvailableMahjongSynthesisOptions({
  gameStatus,
  anchorTower,
  fieldTowers,
  walls,
  availableWhiteCount
}: MahjongSynthesisAvailabilityRequest): AvailableMahjongSynthesisOption[] {
  const materialTowers = fieldTowers.filter(tower => (
    tower.id !== anchorTower.id && tower.mahjongTile && tower.mahjongState
  ))
  const towerSelections = collectTowerMaterialSelections(materialTowers)
  const tileWalls = walls.filter(wall => (
    wall.type === 'obstacle'
      && wall.mahjongWallKind === 'tile'
      && wall.mahjongTile
  ))
  const options: AvailableMahjongSynthesisOption[] = []
  const anchorLogicalTileCount = anchorTower.mahjongState
    ? MAHJONG_FORMATION_TILE_COUNTS[anchorTower.mahjongState.formation]
    : 0

  SYNTHESIS_RECIPES.forEach(recipe => {
    const allowsCatalysts = recipe.formation === 'chow' || recipe.formation === 'pung'
    const wallSelections: Array<GridCell | null> = allowsCatalysts
      ? [null, ...tileWalls]
      : [null]
    const whiteSelections = allowsCatalysts && availableWhiteCount > 0
      ? [0, 1] as const
      : [0] as const

    towerSelections.forEach(selectedTowers => {
      const selectedLogicalTileCount = selectedTowers.reduce((count, tower) => (
        count + MAHJONG_FORMATION_TILE_COUNTS[tower.mahjongState!.formation]
      ), 0)
      wallSelections.forEach(selectedWall => {
        whiteSelections.forEach(whiteCount => {
          const logicalTileCount = anchorLogicalTileCount
            + selectedLogicalTileCount
            + (selectedWall ? 1 : 0)
            + whiteCount
          if (logicalTileCount !== MAHJONG_FORMATION_TILE_COUNTS[recipe.formation]) return

          const result = planMahjongSynthesis({
            gameStatus,
            anchor: anchorTower,
            materials: [
              ...selectedTowers.map(tower => ({ kind: 'tower' as const, tower })),
              ...(selectedWall
                ? [{ kind: 'wall' as const, wall: selectedWall }]
                : [])
            ],
            recipe,
            whiteCount,
            availableWhiteCount
          })
          if (!result.ok) return

          options.push({
            recipe,
            materialTowerIds: selectedTowers.map(tower => tower.id),
            wallPosition: selectedWall
              ? { row: selectedWall.row, col: selectedWall.col }
              : null,
            useWhite: whiteCount === 1
          })
        })
      })
    })
  })

  return options
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits,
    useGrouping: false
  })
}

function formatPercent(value: number): string {
  return formatNumber(value * 100)
}

function formatSeconds(durationMs: number): string {
  return formatNumber(durationMs / 1000, 2)
}

export function getMahjongStateFinalStats(
  state: Pick<MahjongTowerState, 'activeSources' | 'formation' | 'suit'>
): MahjongRandomStats {
  return calculateMahjongFormationStats(
    state.activeSources,
    state.formation,
    state.suit
  )
}

/**
 * Returns the complete mechanics that affect a real attack for this exact
 * suit/formation/attachment combination. The stat line intentionally remains
 * pre-中 because 中 is applied per attack cycle rather than written to the tower.
 */
export function getMahjongAbilitySummary(
  state: Pick<MahjongTowerState, 'suit' | 'formation' | 'attachments'>
): string[] {
  const mechanics = MAHJONG_FORMATION_MECHANICS[state.suit][state.formation]
  const hasRed = state.attachments.includes('red')
  const hasGreen = state.attachments.includes('green')
  const damageType = MAHJONG_SUIT_COMBAT_CONFIG[state.suit].damageType
  const summary = [damageType === 'physical' ? '物理伤害' : '魔法伤害']

  const criticalChance = (mechanics.crit?.chance ?? 0)
    + (hasRed ? MAHJONG_RED_ATTACHMENT_CONFIG.critChanceBonus : 0)
  if (criticalChance > 0) {
    const criticalMultiplier = mechanics.crit?.multiplier
      ?? MAHJONG_RED_ATTACHMENT_CONFIG.defaultCritMultiplier
    summary.push(
      `暴击${formatPercent(Math.min(1, criticalChance))}%，暴伤×${formatNumber(criticalMultiplier)}`
    )
  }
  if (mechanics.armorIgnoreRatio !== undefined) {
    summary.push(`忽略护甲${formatPercent(mechanics.armorIgnoreRatio)}%`)
  }
  if (mechanics.poison) {
    summary.push(
      `毒伤${formatNumber(mechanics.poison.damagePerSecond)}/秒，持续${formatSeconds(mechanics.poison.durationMs)}秒，同来源最多${mechanics.poison.maxStacks}层`
    )
  }
  if (mechanics.attackFrequencyMultiplier !== undefined) {
    summary.push(`额外攻击频率×${formatNumber(mechanics.attackFrequencyMultiplier)}`)
  }
  if (mechanics.splash) {
    summary.push(
      `溅射${formatNumber(mechanics.splash.radius)}像素，周围敌人承受${formatPercent(mechanics.splash.damageRatio)}%伤害`
    )
  }
  if (mechanics.slow) {
    summary.push(
      `减速${formatPercent(mechanics.slow.ratio)}%，持续${formatSeconds(mechanics.slow.durationMs)}秒`
    )
  }
  if (mechanics.projectileCount && mechanics.maxTargets) {
    summary.push(
      `顺子${mechanics.projectileCount}发，最多${mechanics.maxTargets}个目标，总伤害按实际目标数均分`
    )
  }

  if (hasRed) {
    const red = MAHJONG_RED_ATTACHMENT_CONFIG
    summary.push(
      `中：总伤害×${formatNumber(red.damageMultiplier)}，暴击率已增加${formatPercent(red.critChanceBonus)}%，灼烧${formatNumber(red.burn.damagePerSecond)}/秒持续${formatSeconds(red.burn.durationMs)}秒（不叠层）`
    )
  }
  if (hasGreen && state.suit === 'characters') {
    const green = MAHJONG_GREEN_ATTACHMENT_CONFIG.characters
    summary.push(
      `發：普通敌人低于${formatPercent(green.executeHealthRatio)}%、Boss低于${formatPercent(green.bossExecuteHealthRatio)}%生命时处决`
    )
  }
  if (hasGreen && state.suit === 'bamboo') {
    const green = MAHJONG_GREEN_ATTACHMENT_CONFIG.bamboo
    summary.push(
      `發：同目标每次命中攻击频率+${formatPercent(green.attackFrequencyBonusPerHit)}%，最多${green.maxStacks}层，${formatSeconds(green.resetAfterMs)}秒未命中或换目标重置`
    )
  }
  if (hasGreen && state.suit === 'dots') {
    const green = MAHJONG_GREEN_ATTACHMENT_CONFIG.dots
    summary.push(
      `發：${formatPercent(green.stunChance)}%眩晕，普通敌人${formatSeconds(green.stunDurationMs)}秒、Boss ${formatSeconds(green.bossStunDurationMs)}秒`
    )
  }

  return summary
}

export interface MahjongHonorDescription {
  honor: MahjongHonor
  title: string
  kind: 'attachment' | 'catalyst'
  effects: string[]
  usageNote: string
}

/**
 * Player-facing explanation of a 中/發/白 tile before it is committed. All
 * figures are derived from the Mahjong config so the copy tracks tuning; 中/發
 * are attachments gated by MAHJONG_ATTACHMENT_CAPACITY, 白 is a synthesis catalyst.
 */
export function getMahjongHonorDescription(honor: MahjongHonor): MahjongHonorDescription {
  const attachmentUsageNote = [
    '只能附着到有容量且未携带同种功能牌的持久激活塔：',
    `${MAHJONG_FORMATION_LABELS.single}、${MAHJONG_FORMATION_LABELS.pair}各有 ${MAHJONG_ATTACHMENT_CAPACITY.single} 个附着位，`,
    `${MAHJONG_FORMATION_LABELS.chow}、${MAHJONG_FORMATION_LABELS.pung}、${MAHJONG_FORMATION_LABELS.kong}各有 ${MAHJONG_ATTACHMENT_CAPACITY.chow} 个附着位；`,
    '同种功能牌不可重复附着，使用后消耗并在本局持续生效。'
  ].join('')

  if (honor === 'red') {
    const red = MAHJONG_RED_ATTACHMENT_CONFIG
    return {
      honor,
      title: MAHJONG_HONOR_LABELS.red,
      kind: 'attachment',
      effects: [
        `本次攻击总原始伤害×${formatNumber(red.damageMultiplier)}`,
        `暴击率增加${formatPercent(red.critChanceBonus)}个百分点`,
        `原本没有暴击的${MAHJONG_SUIT_LABELS.bamboo}、${MAHJONG_SUIT_LABELS.dots}使用默认暴伤×${formatNumber(red.defaultCritMultiplier)}，${MAHJONG_SUIT_LABELS.characters}保留自身暴击倍率`,
        `命中附加灼烧${formatNumber(red.burn.damagePerSecond)}/秒、持续${formatSeconds(red.burn.durationMs)}秒（不叠层，重复命中刷新持续时间）`
      ],
      usageNote: attachmentUsageNote
    }
  }

  if (honor === 'green') {
    const green = MAHJONG_GREEN_ATTACHMENT_CONFIG
    return {
      honor,
      title: MAHJONG_HONOR_LABELS.green,
      kind: 'attachment',
      effects: [
        `${MAHJONG_SUIT_LABELS.characters}：普通敌人生命低于${formatPercent(green.characters.executeHealthRatio)}%、Boss 低于${formatPercent(green.characters.bossExecuteHealthRatio)}%时处决`,
        `${MAHJONG_SUIT_LABELS.bamboo}：连续命中同一目标每层攻击频率+${formatPercent(green.bamboo.attackFrequencyBonusPerHit)}%，最多${green.bamboo.maxStacks}层，${formatSeconds(green.bamboo.resetAfterMs)}秒未命中或换目标重置`,
        `${MAHJONG_SUIT_LABELS.dots}：每次命中${formatPercent(green.dots.stunChance)}%概率眩晕，普通敌人${formatSeconds(green.dots.stunDurationMs)}秒、Boss ${formatSeconds(green.dots.bossStunDurationMs)}秒`
      ],
      usageNote: attachmentUsageNote
    }
  }

  const white = MAHJONG_WHITE_CATALYST_CONFIG
  const allowedLabel = white.allowedFormations
    .map(formation => MAHJONG_FORMATION_LABELS[formation])
    .join('或')
  return {
    honor,
    title: MAHJONG_HONOR_LABELS.white,
    kind: 'catalyst',
    effects: [
      `只能在${allowedLabel}中作为万能材料替代缺失的逻辑牌位`,
      `每次合成最多使用 ${white.maxPerSynthesis} 张，成功确认后才消耗`,
      '不提供实体数牌、随机属性或附着，也不能作为锚点'
    ],
    usageNote: `白无法直接激活或附着，只能在合成工作台里作为${allowedLabel}的催化材料使用。`
  }
}

export function getMahjongPairRouteHint(
  state: Pick<MahjongTowerState, 'formation' | 'suit' | 'ranks'>
): string | null {
  if (state.formation !== 'pair' || state.ranks.length === 0) return null
  const face = getMahjongTileName({ suit: state.suit, rank: state.ranks[0] })
  return `听碰：缺1张${face}（主动单牌、同牌牌墙或白）；听杠：缺2张主动${face}，或1组相同对子。`
}

export interface MahjongSynthesisSubmitRequest {
  anchorTowerId: string
  materialTowerIds?: string[]
  wallPositions?: Array<{ row: number; col: number }>
  recipe: MahjongSynthesisRecipe
  useWhite?: boolean
}

export type MahjongSynthesisSubmitResult =
  | { ok: true; towerId?: string }
  | { ok: false; reason: MahjongSynthesisFailure }

export type MahjongWallRemovalSubmitResult =
  | { ok: true; returnedTileId: string | null }
  | { ok: false; reason: MahjongWallRemovalFailure }

export function submitMahjongSynthesis(
  request: MahjongSynthesisSubmitRequest,
  onConfirm: (request: MahjongSynthesisSubmitRequest) => MahjongSynthesisSubmitResult,
  onClose: () => void
): MahjongSynthesisSubmitResult {
  const result = onConfirm(request)
  if (result.ok) onClose()
  return result
}

export function submitMahjongWallRemoval(
  position: { row: number; col: number },
  onRemove: (position: { row: number; col: number }) => MahjongWallRemovalSubmitResult,
  onClose: () => void
): MahjongWallRemovalSubmitResult {
  const result = onRemove(position)
  if (result.ok) onClose()
  return result
}

export function getOriginalMahjongStats(tower: Tower): MahjongRandomStats {
  const matchingSource = tower.mahjongState?.activeSources.find(source => (
    source.tileId === tower.mahjongTile?.id
  )) ?? tower.mahjongState?.activeSources[0]
  return matchingSource?.originalStats ?? {
    damage: tower.damage,
    attackIntervalMs: tower.attackSpeed,
    attackRange: tower.range
  }
}

export function getMahjongSuitMechanicLabel(tower: Tower): string {
  const suit = tower.mahjongTile?.suit
  if (!suit) return '未知花色机制'
  const mechanics = MAHJONG_FORMATION_MECHANICS[suit].single
  if (mechanics.crit) {
    return `暴击${Math.round(mechanics.crit.chance * 100)}%，${mechanics.crit.multiplier}倍伤害`
  }
  if (mechanics.poison) {
    return `毒素${mechanics.poison.damagePerSecond}点/秒，持续${mechanics.poison.durationMs / 1000}秒`
  }
  if (mechanics.slow) {
    return `减速${Math.round(mechanics.slow.ratio * 100)}%，持续${mechanics.slow.durationMs / 1000}秒`
  }
  return '基础花色机制'
}

export function getMahjongTowerComparisonLabel(tower: Tower): string {
  const state = tower.mahjongState
  if (!state) {
    const stats = getOriginalMahjongStats(tower)
    return `伤害${formatNumber(stats.damage)}，攻击间隔${formatNumber(stats.attackIntervalMs, 0)}毫秒，攻击距离${formatNumber(stats.attackRange)}，未知麻将机制`
  }

  const stats = getMahjongStateFinalStats(state)
  return [
    MAHJONG_FORMATION_LABELS[state.formation],
    `伤害${formatNumber(stats.damage)}`,
    `攻击间隔${formatNumber(stats.attackIntervalMs, 0)}毫秒`,
    `攻击距离${formatNumber(stats.attackRange)}`,
    ...getMahjongAbilitySummary(state)
  ].join('；')
}

export function getMahjongTowerActionLabel(
  tower: Tower,
  attachment: MahjongAttachment | null = null
): string {
  const name = tower.mahjongTile ? getMahjongTileName(tower.mahjongTile) : '棋子'
  const action = attachment
    ? `将${MAHJONG_HONOR_LABELS[attachment]}附着到${name}`
    : `以${name}为锚点打开合成工作台`
  const pairHint = tower.mahjongState
    ? getMahjongPairRouteHint(tower.mahjongState)
    : null

  return [
    action,
    getMahjongTowerComparisonLabel(tower),
    ...(pairHint ? [pairHint] : [])
  ].join('；')
}
