import { describe, expect, it } from 'vitest'
import {
  MAHJONG_ATTACHMENT_CAPACITY,
  MAHJONG_FORMATION_MECHANICS,
  MAHJONG_GREEN_ATTACHMENT_CONFIG,
  MAHJONG_HONOR_LABELS,
  MAHJONG_RED_ATTACHMENT_CONFIG,
  MAHJONG_SUIT_LABELS,
  MAHJONG_WHITE_CATALYST_CONFIG
} from '../config/mahjong'
import type {
  GridCell,
  MahjongAttachment,
  MahjongFormation,
  MahjongRank,
  MahjongSuit,
  MahjongTowerState,
  Tower
} from '../types/game'
import {
  ATTACHMENT_FAILURE_MESSAGES,
  getAvailableMahjongSynthesisOptions,
  getMahjongAbilitySummary,
  getMahjongHonorAttachmentPreview,
  getMahjongPairRouteHint,
  getMahjongStateFinalStats,
  getMahjongTowerActionLabel,
  getMahjongTowerComparisonLabel,
  getMahjongWhiteCatalystDescription
} from './mahjongUiModel'

function createSynthesisTower(
  id: string,
  rank: MahjongRank,
  col: number,
  formation: MahjongFormation = 'single'
): Tower {
  const logicalTileCount = formation === 'single'
    ? 1
    : formation === 'pair'
      ? 2
      : formation === 'kong'
        ? 4
        : 3
  const ranks = formation === 'chow'
    ? [rank, (rank + 1) as MahjongRank, (rank + 2) as MahjongRank]
    : Array.from({ length: logicalTileCount }, () => rank)
  const tileIds = Array.from(
    { length: logicalTileCount },
    (_, index) => `${id}-tile-${index}`
  )
  const state: MahjongTowerState = {
    formation,
    suit: 'characters',
    ranks,
    containedTileIds: tileIds,
    activeSources: tileIds.map(tileId => ({
      tileId,
      originalStats: {
        damage: 30,
        attackIntervalMs: 1000,
        attackRange: 120
      }
    })),
    attachments: []
  }

  return {
    id,
    mahjongTile: {
      id: tileIds[0],
      suit: 'characters',
      rank,
      copy: 1
    },
    mahjongState: state,
    level: 'chipped',
    gridPosition: { row: 1, col },
    position: { x: col * 40 + 20, y: 60 },
    damage: 30,
    range: 120,
    attackSpeed: 1000,
    lastAttackTime: 0,
    damageType: 'physical'
  }
}

function createSynthesisWall(
  rank: MahjongRank,
  col: number
): GridCell {
  return {
    row: 2,
    col,
    type: 'obstacle',
    mahjongWallKind: 'tile',
    mahjongTile: {
      id: `wall-${rank}-${col}`,
      suit: 'characters',
      rank,
      copy: 2
    }
  }
}

function createState(
  suit: MahjongSuit,
  formation: MahjongFormation,
  attachments: MahjongAttachment[] = []
): MahjongTowerState {
  const sourceCount = formation === 'single'
    ? 1
    : formation === 'pair'
      ? 2
      : formation === 'kong'
        ? 4
        : 3
  const rank = formation === 'chow' ? [3, 4, 5] : Array(sourceCount).fill(3)
  return {
    formation,
    suit,
    ranks: rank as MahjongTowerState['ranks'],
    containedTileIds: Array.from({ length: sourceCount }, (_, index) => `tile-${index}`),
    activeSources: Array.from({ length: sourceCount }, (_, index) => ({
      tileId: `tile-${index}`,
      originalStats: {
        damage: suit === 'bamboo' ? 15 : suit === 'dots' ? 24 : 30,
        attackIntervalMs: suit === 'bamboo' ? 500 : 1000,
        attackRange: 120
      }
    })),
    attachments
  }
}

function createTower(state: MahjongTowerState): Tower {
  return {
    id: 'tower',
    mahjongTile: {
      id: state.containedTileIds[0],
      suit: state.suit,
      rank: state.ranks[0],
      copy: 1
    },
    mahjongState: state,
    level: 'chipped',
    gridPosition: { row: 1, col: 1 },
    position: { x: 60, y: 60 },
    damage: 1,
    range: 1,
    attackSpeed: 1,
    lastAttackTime: 0,
    damageType: state.suit === 'dots' ? 'magic' : 'physical'
  }
}

describe('mahjong final UI presentation', () => {
  it('recomputes a pair from all sources and exposes its actual crit, armor and waits', () => {
    const state = createState('characters', 'pair')

    expect(getMahjongStateFinalStats(state)).toEqual({
      damage: 64.5,
      attackIntervalMs: 1000 / 1.05,
      attackRange: 126
    })
    expect(getMahjongAbilitySummary(state)).toEqual([
      '物理伤害',
      '暴击15%，暴伤×2',
      '忽略护甲25%'
    ])
    expect(getMahjongPairRouteHint(state)).toBe(
      '听碰：缺1张三萬（主动单牌、同牌牌墙或白板）；听杠：缺2张主动三萬、1组相同对子，或用白板补足缺口。'
    )

    const tower = createTower(state)
    const comparison = getMahjongTowerComparisonLabel(tower)
    expect(comparison).toContain('对子；伤害64.5；攻击间隔952毫秒；攻击距离126')
    expect(comparison).toContain('暴击15%，暴伤×2；忽略护甲25%')
    expect(comparison).not.toContain('伤害1')

    const actionLabel = getMahjongTowerActionLabel(tower, 'red')
    expect(actionLabel).toContain('将中附着到三萬；对子；伤害64.5')
    expect(actionLabel).toContain('听碰：缺1张三萬')
    expect(actionLabel).not.toContain('tile-0')
  })

  it('summarizes a bamboo kong with its poison plus simultaneous 中 and 發', () => {
    const state = createState('bamboo', 'kong', ['red', 'green'])
    const summary = getMahjongAbilitySummary(state)

    expect(summary).toContain('物理伤害')
    expect(summary).toContain('暴击10%，暴伤×2')
    expect(summary).toContain('毒伤12/秒，持续5秒，同来源最多4层')
    expect(summary).toContain('中：总伤害×1.25，暴击率已增加10%，灼烧6/秒持续3秒（不叠层）')
    expect(summary).toContain('發：同目标每次命中攻击频率+3%，最多10层，2秒未命中或换目标重置')
  })

  it('summarizes chow damage distribution and dot control with both attachments', () => {
    const state = createState('dots', 'chow', ['red', 'green'])
    const summary = getMahjongAbilitySummary(state)

    expect(summary).toContain('魔法伤害')
    expect(summary).toContain('顺子3发，最多3个目标，总伤害按实际目标数均分')
    expect(summary).toContain('减速25%，持续1.5秒')
    expect(summary).toContain('暴击10%，暴伤×2')
    expect(summary).toContain('中：总伤害×1.25，暴击率已增加10%，灼烧6/秒持续3秒（不叠层）')
    expect(summary).toContain('發：12%眩晕，普通敌人0.8秒、Boss 0.35秒')
    expect(getMahjongPairRouteHint(state)).toBeNull()
  })

  it('includes the final dot splash ratio and slow for a kong', () => {
    const summary = getMahjongAbilitySummary(createState('dots', 'kong'))

    expect(summary).toContain('魔法伤害')
    expect(summary).toContain('溅射55像素，周围敌人承受100%伤害')
    expect(summary).toContain('减速55%，持续2.5秒')
  })
})

describe('available Mahjong synthesis options', () => {
  const getFormations = (options: ReturnType<typeof getAvailableMahjongSynthesisOptions>) => (
    new Set(options.map(option => option.recipe.formation))
  )

  it('publishes pair only when a matching active single can complete it', () => {
    const anchor = createSynthesisTower('anchor', 3, 1)
    const mate = createSynthesisTower('mate', 3, 2)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor, mate],
      walls: [],
      availableWhiteCount: 0
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [createSynthesisWall(3, 3)],
      availableWhiteCount: 1
    })

    expect(getFormations(available)).toContain('pair')
    expect(available).toContainEqual({
      recipe: { formation: 'pair' },
      materialTowerIds: ['mate'],
      wallPosition: null,
      whiteCount: 0
    })
    expect(getFormations(unavailable)).not.toContain('pair')
  })

  it('keeps a chow that can be completed by one matching wall plus white', () => {
    const anchor = createSynthesisTower('anchor', 4, 1)
    const wall = createSynthesisWall(3, 3)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'building',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [wall],
      availableWhiteCount: 1
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'building',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [wall],
      availableWhiteCount: 0
    })

    expect(available).toContainEqual({
      recipe: { formation: 'chow', ranks: [3, 4, 5] },
      materialTowerIds: [],
      wallPosition: { row: 2, col: 3 },
      whiteCount: 1
    })
    expect(getFormations(available)).toContain('chow')
    expect(getFormations(unavailable)).not.toContain('chow')
  })

  it('publishes pung for a matching pair but not for the wrong face', () => {
    const anchor = createSynthesisTower('anchor', 3, 1)
    const matchingPair = createSynthesisTower('matching-pair', 3, 2, 'pair')
    const wrongPair = createSynthesisTower('wrong-pair', 4, 3, 'pair')
    const matchingWall = createSynthesisWall(3, 4)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor, matchingPair],
      walls: [],
      availableWhiteCount: 0
    })
    const unavailable = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor, wrongPair],
      walls: [],
      availableWhiteCount: 0
    })
    const wallAndWhite = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [matchingWall],
      availableWhiteCount: 1
    })

    expect(getFormations(available)).toContain('pung')
    expect(wallAndWhite).toContainEqual({
      recipe: { formation: 'pung' },
      materialTowerIds: [],
      wallPosition: { row: 2, col: 4 },
      whiteCount: 1
    })
    expect(getFormations(unavailable)).not.toContain('pung')
  })

  it('publishes kong from a matching active single without a wall or white', () => {
    const pung = createSynthesisTower('anchor-pung', 3, 1, 'pung')
    const single = createSynthesisTower('matching-single', 3, 2)
    const available = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: pung,
      fieldTowers: [pung, single],
      walls: [],
      availableWhiteCount: 0
    })

    expect(getFormations(available)).toContain('kong')
    expect(available).toContainEqual({
      recipe: { formation: 'kong' },
      materialTowerIds: ['matching-single'],
      wallPosition: null,
      whiteCount: 0
    })
  })

  it('fills kong routes with white across anchor shapes but never absorbs a wall', () => {
    const pungAnchor = createSynthesisTower('anchor-pung', 3, 1, 'pung')
    // 明刻锚（3 张）+ 1 白 → 杠；同点牌墙在场也绝不被杠吸收。
    const pungWhite = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: pungAnchor,
      fieldTowers: [pungAnchor],
      walls: [createSynthesisWall(3, 3)],
      availableWhiteCount: 1
    })
    const pungKong = pungWhite.filter(option => option.recipe.formation === 'kong')
    expect(pungKong).toContainEqual({
      recipe: { formation: 'kong' },
      materialTowerIds: [],
      wallPosition: null,
      whiteCount: 1
    })
    expect(pungKong.every(option => option.wallPosition === null)).toBe(true)

    // 对子锚（2 张）+ 2 白 → 杠。
    const pairAnchor = createSynthesisTower('anchor-pair', 3, 1, 'pair')
    const pairWhite = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: pairAnchor,
      fieldTowers: [pairAnchor],
      walls: [],
      availableWhiteCount: 2
    })
    expect(pairWhite.filter(option => option.recipe.formation === 'kong')).toContainEqual({
      recipe: { formation: 'kong' },
      materialTowerIds: [],
      wallPosition: null,
      whiteCount: 2
    })

    // 单牌锚（1 张）+ 3 白 → 杠；库存不足 3 张时该路线消失。
    const singleAnchor = createSynthesisTower('anchor-single', 3, 1)
    const singleWhite = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: singleAnchor,
      fieldTowers: [singleAnchor],
      walls: [],
      availableWhiteCount: 3
    })
    expect(singleWhite.filter(option => option.recipe.formation === 'kong')).toContainEqual({
      recipe: { formation: 'kong' },
      materialTowerIds: [],
      wallPosition: null,
      whiteCount: 3
    })
    const singleScarce = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: singleAnchor,
      fieldTowers: [singleAnchor],
      walls: [],
      availableWhiteCount: 2
    })
    expect(getFormations(singleScarce)).not.toContain('kong')
  })

  it('enumerates multi-white chow and pung options only within the white stock', () => {
    const anchor = createSynthesisTower('anchor', 3, 1)
    const stocked = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [],
      availableWhiteCount: 2
    })
    // 单牌锚 + 2 白凑碰（排尾白位）。
    expect(stocked).toContainEqual({
      recipe: { formation: 'pung' },
      materialTowerIds: [],
      wallPosition: null,
      whiteCount: 2
    })
    // 单牌锚 + 2 白凑吃，白补齐缺口点位。
    expect(stocked).toContainEqual({
      recipe: { formation: 'chow', ranks: [3, 4, 5] },
      materialTowerIds: [],
      wallPosition: null,
      whiteCount: 2
    })

    const scarce = getAvailableMahjongSynthesisOptions({
      gameStatus: 'ready',
      anchorTower: anchor,
      fieldTowers: [anchor],
      walls: [],
      availableWhiteCount: 1
    })
    expect(getFormations(scarce)).not.toContain('pung')
    expect(getFormations(scarce)).not.toContain('chow')
  })
})

describe('mahjong honor attachment preview', () => {
  const formatNumber = (value: number, maximumFractionDigits = 2) =>
    value.toLocaleString('zh-CN', { maximumFractionDigits, useGrouping: false })
  const formatPercent = (value: number) => formatNumber(value * 100)
  const formatSeconds = (durationMs: number) => formatNumber(durationMs / 1000, 2)

  it('describes 中 with damage, crit bonus, burn and suit-specific crit multiplier', () => {
    const config = MAHJONG_RED_ATTACHMENT_CONFIG
    const charactersPung = getMahjongHonorAttachmentPreview('red', createState('characters', 'pung'))
    const bamboo = getMahjongHonorAttachmentPreview('red', createState('bamboo', 'single'))
    const dots = getMahjongHonorAttachmentPreview('red', createState('dots', 'single'))

    expect(charactersPung.honor).toBe('red')
    expect(charactersPung.title).toBe(MAHJONG_HONOR_LABELS.red)
    expect(charactersPung.suitLabel).toBe(MAHJONG_SUIT_LABELS.characters)
    expect(charactersPung.formationLabel).toBe('明刻')

    const charactersJoined = charactersPung.effects.join('\n')
    expect(charactersJoined).toContain(`本次攻击总原始伤害×${formatNumber(config.damageMultiplier)}`)
    expect(charactersJoined).toContain(`暴击率增加${formatPercent(config.critChanceBonus)}个百分点`)
    expect(charactersJoined).toContain(`命中附加灼烧${formatNumber(config.burn.damagePerSecond)}/秒`)
    expect(charactersJoined).toContain(`持续${formatSeconds(config.burn.durationMs)}秒`)

    // 万保留自身（牌型专属）暴击倍率；条/筒无原生暴击用中的默认倍率。
    const charactersCritMultiplier = MAHJONG_FORMATION_MECHANICS.characters.pung.crit!.multiplier
    expect(charactersPung.effects).toContain(
      `${MAHJONG_SUIT_LABELS.characters}保留自身暴击倍率，暴伤×${formatNumber(charactersCritMultiplier)}`
    )
    expect(bamboo.effects).toContain(
      `${MAHJONG_SUIT_LABELS.bamboo}原本无暴击，中赋予默认暴伤×${formatNumber(config.defaultCritMultiplier)}`
    )
    expect(dots.effects).toContain(
      `${MAHJONG_SUIT_LABELS.dots}原本无暴击，中赋予默认暴伤×${formatNumber(config.defaultCritMultiplier)}`
    )
  })

  it('shows only the target suit line for 發', () => {
    const config = MAHJONG_GREEN_ATTACHMENT_CONFIG
    const characters = getMahjongHonorAttachmentPreview('green', createState('characters', 'chow'))
    const bamboo = getMahjongHonorAttachmentPreview('green', createState('bamboo', 'chow'))
    const dots = getMahjongHonorAttachmentPreview('green', createState('dots', 'chow'))

    expect(characters.effects).toHaveLength(1)
    expect(characters.effects[0]).toContain(MAHJONG_SUIT_LABELS.characters)
    expect(characters.effects[0]).toContain(`${formatPercent(config.characters.executeHealthRatio)}%`)
    expect(characters.effects[0]).toContain(`${formatPercent(config.characters.bossExecuteHealthRatio)}%`)
    expect(characters.effects[0]).not.toContain(MAHJONG_SUIT_LABELS.bamboo)

    expect(bamboo.effects).toHaveLength(1)
    expect(bamboo.effects[0]).toContain(MAHJONG_SUIT_LABELS.bamboo)
    expect(bamboo.effects[0]).toContain(`+${formatPercent(config.bamboo.attackFrequencyBonusPerHit)}%`)
    expect(bamboo.effects[0]).toContain(`${config.bamboo.maxStacks}层`)
    expect(bamboo.effects[0]).toContain(`${formatSeconds(config.bamboo.resetAfterMs)}秒`)

    expect(dots.effects).toHaveLength(1)
    expect(dots.effects[0]).toContain(MAHJONG_SUIT_LABELS.dots)
    expect(dots.effects[0]).toContain(`${formatPercent(config.dots.stunChance)}%`)
    expect(dots.effects[0]).toContain(`${formatSeconds(config.dots.stunDurationMs)}秒`)
    expect(dots.effects[0]).toContain(`${formatSeconds(config.dots.bossStunDurationMs)}秒`)
  })

  it('pre-checks capacity and duplicate attachments against the tower state', () => {
    const alreadyAttached = getMahjongHonorAttachmentPreview('red', createState('characters', 'single', ['red']))
    expect(alreadyAttached.canAttach).toBe(false)
    expect(alreadyAttached.blockReason).toBe('already_attached')

    const capacityFull = getMahjongHonorAttachmentPreview('green', createState('characters', 'single', ['red']))
    expect(capacityFull.capacity).toBe(MAHJONG_ATTACHMENT_CAPACITY.single)
    expect(capacityFull.attachedCount).toBe(1)
    expect(capacityFull.canAttach).toBe(false)
    expect(capacityFull.blockReason).toBe('attachment_capacity')

    const available = getMahjongHonorAttachmentPreview('green', createState('dots', 'chow', ['red']))
    expect(available.capacity).toBe(MAHJONG_ATTACHMENT_CAPACITY.chow)
    expect(available.attachedHonors).toEqual(['red'])
    expect(available.canAttach).toBe(true)
    expect(available.blockReason).toBeNull()

    // 预检查原因文案与引擎失败原因共享同一映射。
    expect(ATTACHMENT_FAILURE_MESSAGES.already_attached).toContain('相同功能牌')
    expect(ATTACHMENT_FAILURE_MESSAGES.attachment_capacity).toContain('附着容量')
  })
})

describe('mahjong white catalyst description', () => {
  it('describes 白 as a stock-limited catalyst for 吃碰杠 without capacity copy', () => {
    const white = getMahjongWhiteCatalystDescription()
    const joined = white.effects.join('\n')

    expect(white.title).toBe(MAHJONG_HONOR_LABELS.white)
    // 允许形态由配置派生，现已含杠。
    expect(MAHJONG_WHITE_CATALYST_CONFIG.allowedFormations).toContain('kong')
    expect(joined).toContain('杠')
    expect(joined).toContain('任意数量')
    expect(joined).toContain('白板库存')
    // 催化不占附着容量：白说明不复用容量文案。
    expect(white.usageNote).not.toContain('附着位')
  })
})
