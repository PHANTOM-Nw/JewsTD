import {
  getMahjongTileName,
  MAHJONG_FORMATION_MECHANICS,
  MAHJONG_GREEN_ATTACHMENT_CONFIG,
  MAHJONG_HONOR_LABELS,
  MAHJONG_RED_ATTACHMENT_CONFIG,
  MAHJONG_SUIT_COMBAT_CONFIG
} from '../config/mahjong'
import type {
  MahjongSynthesisFailure,
  MahjongSynthesisRecipe
} from '../engine/mahjongSynthesis'
import { calculateMahjongFormationStats } from '../engine/mahjongStats'
import type { MahjongWallRemovalFailure } from '../engine/mahjongWalls'
import type {
  MahjongAttachment,
  MahjongFormation,
  MahjongRandomStats,
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
