import type {
  GameStatus,
  GridCell,
  MahjongAttachment,
  MahjongFormation,
  MahjongRank,
  MahjongTowerState,
  Tower
} from '../types/game'
import {
  MAHJONG_ATTACHMENT_CAPACITY,
  MAHJONG_FORMATION_TILE_COUNTS,
  MAHJONG_WHITE_CATALYST_CONFIG
} from '../config/mahjong'

export type MahjongSynthesisTower = Pick<
  Tower,
  'id' | 'gridPosition' | 'mahjongTile' | 'mahjongState'
>

export type MahjongSynthesisWall = Pick<
  GridCell,
  'row' | 'col' | 'type' | 'mahjongTile' | 'mahjongWallKind'
>

export type MahjongSynthesisMaterial =
  | { kind: 'tower'; tower: MahjongSynthesisTower }
  | { kind: 'wall'; wall: MahjongSynthesisWall }

export type MahjongSynthesisRecipe =
  | { formation: 'pair' }
  | { formation: 'chow'; ranks: readonly [MahjongRank, MahjongRank, MahjongRank] }
  | { formation: 'pung' }
  | { formation: 'kong' }

export interface MahjongSynthesisRequest {
  gameStatus: GameStatus
  anchor: MahjongSynthesisTower
  materials: readonly MahjongSynthesisMaterial[]
  recipe: MahjongSynthesisRecipe
  whiteCount?: number
  availableWhiteCount?: number
}

export type MahjongSynthesisFailure =
  | 'invalid_phase'
  | 'invalid_anchor'
  | 'invalid_entity_state'
  | 'duplicate_material'
  | 'terminal_formation'
  | 'too_many_walls'
  | 'invalid_wall'
  | 'wall_not_allowed'
  | 'too_many_white'
  | 'white_unavailable'
  | 'white_not_allowed'
  | 'invalid_material_count'
  | 'invalid_face'
  | 'invalid_chow'
  | 'invalid_route'

export interface MahjongGridPosition {
  row: number
  col: number
}

/**
 * 合成的纯事务计划。调用者只有在 ok=true 时才应一次性提交这些变化。
 * 非锚点主动塔和被动墙材料的位置都会保留为纯墙体，地图拓扑不变。
 */
export interface MahjongSynthesisPlan {
  anchorTowerId: string
  anchorPosition: MahjongGridPosition
  resultState: MahjongTowerState
  consumedTowerIds: string[]
  consumedWallPositions: MahjongGridPosition[]
  pureWallPositions: MahjongGridPosition[]
  consumedWhiteCount: number
}

export type MahjongSynthesisResult =
  | { ok: true; plan: MahjongSynthesisPlan }
  | { ok: false; reason: MahjongSynthesisFailure }

interface ValidTower {
  tower: MahjongSynthesisTower
  state: MahjongTowerState
}

function positionKey(position: MahjongGridPosition): string {
  return `${position.row},${position.col}`
}

function isPreparationPhase(gameStatus: GameStatus): boolean {
  return gameStatus === 'building' || gameStatus === 'ready'
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function hasValidRanks(state: MahjongTowerState): boolean {
  if (state.ranks.length !== MAHJONG_FORMATION_TILE_COUNTS[state.formation]) return false

  const ranks = [...state.ranks].sort((first, second) => first - second)
  if (state.formation === 'chow') {
    return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
  }

  return ranks.every(rank => rank === ranks[0])
}

function hasValidAttachments(state: MahjongTowerState): boolean {
  const maximum = MAHJONG_ATTACHMENT_CAPACITY[state.formation]
  return state.attachments.length <= maximum
    && new Set<MahjongAttachment>(state.attachments).size === state.attachments.length
}

function hasValidActiveSources(state: MahjongTowerState): boolean {
  if (state.activeSources.length === 0) return false

  return state.activeSources.every(source => {
    const { damage, attackIntervalMs, attackRange } = source.originalStats
    return Number.isFinite(damage)
      && Number.isFinite(attackIntervalMs)
      && Number.isFinite(attackRange)
      && damage >= 0
      && attackIntervalMs > 0
      && attackRange >= 0
  })
}

/** 白同质无 ID，塔上的白仅由 whiteSlotIndices 记录，其长度即白数。 */
export function getWhiteCount(
  state: Pick<MahjongTowerState, 'whiteSlotIndices'>
): number {
  return state.whiteSlotIndices?.length ?? 0
}

/** 白位下标必须升序去重、落在 [0, tileCount) 内，且不能占满所有牌位。 */
function hasValidWhiteSlotIndices(
  indices: readonly number[],
  tileCount: number
): boolean {
  if (indices.length >= tileCount) return false
  return indices.every((index, position) => (
    Number.isInteger(index)
      && index >= 0
      && index < tileCount
      && (position === 0 || index > indices[position - 1])
  ))
}

function hasValidPhysicalSourceCounts(state: MahjongTowerState): boolean {
  const logicalTileCount = MAHJONG_FORMATION_TILE_COUNTS[state.formation]
  const whiteCount = getWhiteCount(state)
  if (whiteCount > 0) {
    if (state.formation !== 'chow'
      && state.formation !== 'pung'
      && state.formation !== 'kong') {
      return false
    }
    if (!hasValidWhiteSlotIndices(state.whiteSlotIndices!, logicalTileCount)) {
      return false
    }
  }

  const expectedContainedCount = logicalTileCount - whiteCount
  if (state.containedTileIds.length !== expectedContainedCount) return false

  const passiveTileCount = state.containedTileIds.length - state.activeSources.length
  if (passiveTileCount < 0 || passiveTileCount > 1) return false

  // Singles and pairs are active-only shapes. Later shapes may contain the one
  // passive tile wall admitted by an earlier chow/pung transaction.
  if (state.formation === 'single' || state.formation === 'pair') {
    return state.activeSources.length === logicalTileCount
  }

  return state.activeSources.length > 0
}

function getValidTower(tower: MahjongSynthesisTower): ValidTower | null {
  const state = tower.mahjongState
  if (
    !state
    || !tower.mahjongTile
    || !hasValidRanks(state)
    || !hasValidAttachments(state)
    || !hasValidActiveSources(state)
    || !hasValidPhysicalSourceCounts(state)
  ) return null
  if (!hasUniqueValues(state.containedTileIds)) return null

  const sourceIds = state.activeSources.map(source => source.tileId)
  if (!hasUniqueValues(sourceIds)) return null
  if (!sourceIds.every(tileId => state.containedTileIds.includes(tileId))) return null

  if (tower.mahjongTile.suit !== state.suit) return null
  if (!state.ranks.includes(tower.mahjongTile.rank)) return null
  if (!state.containedTileIds.includes(tower.mahjongTile.id)) return null
  if (!sourceIds.includes(tower.mahjongTile.id)) return null

  return { tower, state }
}

function validateChowRecipe(
  recipe: Extract<MahjongSynthesisRecipe, { formation: 'chow' }>
): boolean {
  const [first, second, third] = recipe.ranks
  return second === first + 1 && third === second + 1
}

function cloneStateSources(state: MahjongTowerState): MahjongTowerState['activeSources'] {
  return state.activeSources.map(source => ({
    ...source,
    originalStats: { ...source.originalStats }
  }))
}

function inheritAttachments(
  formation: Exclude<MahjongFormation, 'single'>,
  towers: readonly ValidTower[]
): MahjongAttachment[] {
  const inherited: MahjongAttachment[] = []
  towers.forEach(({ state }) => state.attachments.forEach(attachment => {
    if (!inherited.includes(attachment)) inherited.push(attachment)
  }))

  // 对子只能携带一种；锚点位于 towers[0]，所以自然优先继承锚点附着。
  return formation === 'pair' ? inherited.slice(0, 1) : inherited.slice(0, 2)
}

function hasSameFace(towers: readonly ValidTower[], wall: MahjongSynthesisWall | null): boolean {
  const suit = towers[0].state.suit
  const rank = towers[0].state.ranks[0]
  return towers.every(({ state }) => (
    state.suit === suit && state.ranks.every(candidateRank => candidateRank === rank)
  )) && (!wall || (
    wall.mahjongTile?.suit === suit && wall.mahjongTile.rank === rank
  ))
}

/**
 * Any combination of real single/pair/pung sources may grow into a kong. Same-face
 * (hasSameFace) and the four logical tiles (logicalTileCount, which already counts
 * white) keep the shape balanced, so white simply fills whatever real tiles miss.
 */
function isAllowedKongRoute(towers: readonly ValidTower[]): boolean {
  return towers.every(({ state }) => (
    state.formation === 'single'
      || state.formation === 'pair'
      || state.formation === 'pung'
  ))
}

function getResultRanks(
  recipe: MahjongSynthesisRecipe,
  faceRank: MahjongRank
): MahjongRank[] {
  if (recipe.formation === 'chow') return [...recipe.ranks]
  return Array.from({
    length: MAHJONG_FORMATION_TILE_COUNTS[recipe.formation]
  }, () => faceRank)
}

/**
 * Locates the rank slots a white catalyst fills in the result. Chow marks the gap
 * ranks no real tile covers; pung/kong use a deterministic tail so real tiles keep
 * the low positions (and a white pung upgrading to a kong needs no index shuffle).
 * The accumulated white count sums every source tower's inherited white plus the
 * whites added this transaction.
 */
function getResultWhiteSlotIndices(
  recipe: MahjongSynthesisRecipe,
  towers: readonly ValidTower[],
  wall: MahjongSynthesisWall | null,
  whiteCount: number
): number[] {
  const tileCount = MAHJONG_FORMATION_TILE_COUNTS[recipe.formation]
  if (recipe.formation === 'chow') {
    const coveredRanks = new Set<MahjongRank>([
      ...towers.map(({ state }) => state.ranks[0]),
      ...(wall?.mahjongTile ? [wall.mahjongTile.rank] : [])
    ])
    return recipe.ranks.reduce<number[]>((slots, rank, index) => {
      if (!coveredRanks.has(rank)) slots.push(index)
      return slots
    }, [])
  }

  const resultWhite = towers.reduce(
    (total, { state }) => total + getWhiteCount(state),
    whiteCount
  )
  const slots: number[] = []
  for (let index = tileCount - resultWhite; index < tileCount; index += 1) {
    slots.push(index)
  }
  return slots
}

export function planMahjongSynthesis(
  request: MahjongSynthesisRequest
): MahjongSynthesisResult {
  if (!isPreparationPhase(request.gameStatus)) {
    return { ok: false, reason: 'invalid_phase' }
  }

  const anchor = getValidTower(request.anchor)
  if (!anchor) return { ok: false, reason: 'invalid_anchor' }

  const whiteCount = request.whiteCount ?? 0
  const availableWhiteCount = request.availableWhiteCount ?? 0
  // "不能全是白"：白不能作锚点，锚点恒为真实塔，故白数至多为牌位数−1。
  if (
    !Number.isInteger(whiteCount)
    || whiteCount < 0
    || whiteCount > MAHJONG_FORMATION_TILE_COUNTS[request.recipe.formation] - 1
  ) {
    return { ok: false, reason: 'too_many_white' }
  }
  if (
    !Number.isInteger(availableWhiteCount)
    || availableWhiteCount < 0
    || whiteCount > availableWhiteCount
  ) {
    return { ok: false, reason: 'white_unavailable' }
  }

  const materialTowers: ValidTower[] = []
  const walls: MahjongSynthesisWall[] = []
  for (const material of request.materials) {
    if (material.kind === 'tower') {
      const tower = getValidTower(material.tower)
      if (!tower) return { ok: false, reason: 'invalid_entity_state' }
      materialTowers.push(tower)
    } else {
      walls.push(material.wall)
    }
  }

  if (walls.length > 1) return { ok: false, reason: 'too_many_walls' }
  const wall = walls[0] ?? null
  if (wall && (
    wall.type !== 'obstacle'
    || wall.mahjongWallKind !== 'tile'
    || !wall.mahjongTile
  )) {
    return { ok: false, reason: 'invalid_wall' }
  }

  const towers = [anchor, ...materialTowers]
  const towerIds = towers.map(({ tower }) => tower.id)
  const positions = [
    ...towers.map(({ tower }) => tower.gridPosition),
    ...walls.map(candidate => ({ row: candidate.row, col: candidate.col }))
  ]
  const containedTileIds = [
    ...towers.flatMap(({ state }) => state.containedTileIds),
    ...(wall?.mahjongTile ? [wall.mahjongTile.id] : [])
  ]
  if (
    !hasUniqueValues(towerIds)
    || !hasUniqueValues(positions.map(positionKey))
    || !hasUniqueValues(containedTileIds)
  ) {
    return { ok: false, reason: 'duplicate_material' }
  }

  if (towers.some(({ state }) => state.formation === 'chow' || state.formation === 'kong')) {
    return { ok: false, reason: 'terminal_formation' }
  }

  const recipe = request.recipe
  const { formation } = recipe
  if ((formation === 'pair' || formation === 'kong') && wall) {
    return { ok: false, reason: 'wall_not_allowed' }
  }
  const whiteAllowed = MAHJONG_WHITE_CATALYST_CONFIG.allowedFormations.some(
    allowedFormation => allowedFormation === formation
  )
  if (!whiteAllowed && whiteCount > 0) {
    return { ok: false, reason: 'white_not_allowed' }
  }

  const logicalTileCount = towers.reduce(
    (count, { state }) => count + MAHJONG_FORMATION_TILE_COUNTS[state.formation],
    0
  ) + walls.length + whiteCount

  if (logicalTileCount !== MAHJONG_FORMATION_TILE_COUNTS[formation]) {
    return { ok: false, reason: 'invalid_material_count' }
  }

  if (formation === 'pair') {
    if (towers.length !== 2 || towers.some(({ state }) => state.formation !== 'single')) {
      return { ok: false, reason: 'invalid_route' }
    }
    if (!hasSameFace(towers, null)) return { ok: false, reason: 'invalid_face' }
  } else if (recipe.formation === 'chow') {
    if (!validateChowRecipe(recipe)) return { ok: false, reason: 'invalid_chow' }
    if (towers.some(({ state }) => state.formation !== 'single')) {
      return { ok: false, reason: 'invalid_route' }
    }

    const suit = anchor.state.suit
    const concreteTiles = [
      ...towers.map(({ state }) => ({ suit: state.suit, rank: state.ranks[0] })),
      ...(wall?.mahjongTile ? [{ suit: wall.mahjongTile.suit, rank: wall.mahjongTile.rank }] : [])
    ]
    if (concreteTiles.some(tile => tile.suit !== suit)) {
      return { ok: false, reason: 'invalid_face' }
    }
    if (!hasUniqueValues(concreteTiles.map(tile => String(tile.rank)))) {
      return { ok: false, reason: 'invalid_chow' }
    }
    if (concreteTiles.some(tile => !recipe.ranks.includes(tile.rank))) {
      return { ok: false, reason: 'invalid_chow' }
    }
  } else if (formation === 'pung') {
    if (towers.some(({ state }) => state.formation !== 'single' && state.formation !== 'pair')) {
      return { ok: false, reason: 'invalid_route' }
    }
    if (!hasSameFace(towers, wall)) return { ok: false, reason: 'invalid_face' }
  } else {
    if (!isAllowedKongRoute(towers)) return { ok: false, reason: 'invalid_route' }
    if (!hasSameFace(towers, null)) return { ok: false, reason: 'invalid_face' }
  }

  const whiteSlotIndices = getResultWhiteSlotIndices(
    request.recipe,
    towers,
    wall,
    whiteCount
  )
  const resultState: MahjongTowerState = {
    formation,
    suit: anchor.state.suit,
    ranks: getResultRanks(request.recipe, anchor.state.ranks[0]),
    containedTileIds: [...containedTileIds],
    activeSources: towers.flatMap(({ state }) => cloneStateSources(state)),
    attachments: inheritAttachments(formation, towers),
    ...(whiteSlotIndices.length > 0 ? { whiteSlotIndices } : {})
  }
  const pureWallPositions = positions.slice(1).map(position => ({ ...position }))

  return {
    ok: true,
    plan: {
      anchorTowerId: anchor.tower.id,
      anchorPosition: { ...anchor.tower.gridPosition },
      resultState,
      consumedTowerIds: materialTowers.map(({ tower }) => tower.id),
      consumedWallPositions: walls.map(candidate => ({ row: candidate.row, col: candidate.col })),
      pureWallPositions,
      consumedWhiteCount: whiteCount
    }
  }
}
