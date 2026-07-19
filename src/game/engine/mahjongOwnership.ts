import type {
  GridCell,
  MahjongNumberTile,
  MahjongRoundTile,
  MahjongTileId,
  Tower
} from '../types/game'

export type MahjongOwnershipLocation =
  | { kind: 'pool'; index: number }
  | { kind: 'round'; index: number; source: MahjongRoundTile['source'] }
  | { kind: 'held' }
  | { kind: 'tower'; towerId: string }
  | { kind: 'wall'; row: number; col: number }

export interface MahjongOwnershipSnapshot {
  universe: readonly MahjongNumberTile[]
  pool: readonly MahjongNumberTile[]
  roundTiles: readonly MahjongRoundTile[]
  heldTile: MahjongNumberTile | null
  towers: readonly Pick<Tower, 'id' | 'mahjongState'>[]
  grid: readonly (readonly Pick<
    GridCell,
    'row' | 'col' | 'type' | 'mahjongTile' | 'mahjongWallKind'
  >[])[]
}

export interface MahjongOwnershipIssue {
  tileId: MahjongTileId
  locations: readonly MahjongOwnershipLocation[]
}

export interface MahjongOwnershipAudit {
  expectedEntityCount: number
  ownedEntityCount: number
  owners: ReadonlyMap<MahjongTileId, readonly MahjongOwnershipLocation[]>
  duplicates: readonly MahjongOwnershipIssue[]
  missing: readonly MahjongTileId[]
  unknown: readonly MahjongOwnershipIssue[]
  duplicateUniverseIds: readonly MahjongTileId[]
  conserved: boolean
}

function addOwner(
  owners: Map<MahjongTileId, MahjongOwnershipLocation[]>,
  tileId: MahjongTileId,
  location: MahjongOwnershipLocation
) {
  const current = owners.get(tileId)
  if (current) current.push(location)
  else owners.set(tileId, [location])
}

function getDuplicateUniverseIds(
  universe: readonly MahjongNumberTile[]
): MahjongTileId[] {
  const seen = new Set<MahjongTileId>()
  const duplicates = new Set<MahjongTileId>()
  universe.forEach(tile => {
    if (seen.has(tile.id)) duplicates.add(tile.id)
    seen.add(tile.id)
  })
  return [...duplicates]
}

/**
 * Audits physical ownership only. Active-source IDs are references into a tower's
 * contained IDs, while pure walls and honor tiles deliberately own no number tile.
 */
export function auditMahjongOwnership(
  snapshot: MahjongOwnershipSnapshot
): MahjongOwnershipAudit {
  const owners = new Map<MahjongTileId, MahjongOwnershipLocation[]>()

  snapshot.pool.forEach((tile, index) => {
    addOwner(owners, tile.id, { kind: 'pool', index })
  })
  snapshot.roundTiles.forEach((resource, index) => {
    addOwner(owners, resource.tile.id, {
      kind: 'round',
      index,
      source: resource.source
    })
  })
  if (snapshot.heldTile) {
    addOwner(owners, snapshot.heldTile.id, { kind: 'held' })
  }
  snapshot.towers.forEach(tower => {
    tower.mahjongState?.containedTileIds.forEach(tileId => {
      addOwner(owners, tileId, { kind: 'tower', towerId: tower.id })
    })
  })
  snapshot.grid.forEach(row => row.forEach(cell => {
    if (
      cell.type === 'obstacle'
      && cell.mahjongWallKind === 'tile'
      && cell.mahjongTile
    ) {
      addOwner(owners, cell.mahjongTile.id, {
        kind: 'wall',
        row: cell.row,
        col: cell.col
      })
    }
  }))

  const universeIds = new Set(snapshot.universe.map(tile => tile.id))
  const duplicateUniverseIds = getDuplicateUniverseIds(snapshot.universe)
  const duplicates: MahjongOwnershipIssue[] = []
  const unknown: MahjongOwnershipIssue[] = []

  owners.forEach((locations, tileId) => {
    if (locations.length > 1) duplicates.push({ tileId, locations: [...locations] })
    if (!universeIds.has(tileId)) unknown.push({ tileId, locations: [...locations] })
  })

  const missing = [...universeIds].filter(tileId => !owners.has(tileId))
  const ownedEntityCount = [...owners.entries()].reduce(
    (count, [tileId, locations]) => (
      universeIds.has(tileId) ? count + locations.length : count
    ),
    0
  )

  return {
    expectedEntityCount: universeIds.size,
    ownedEntityCount,
    owners,
    duplicates,
    missing,
    unknown,
    duplicateUniverseIds,
    conserved: duplicateUniverseIds.length === 0
      && duplicates.length === 0
      && missing.length === 0
      && unknown.length === 0
      && ownedEntityCount === universeIds.size
  }
}

function issueIds(issues: readonly MahjongOwnershipIssue[]): string {
  return issues.map(issue => issue.tileId).join(', ') || 'none'
}

export class MahjongOwnershipError extends Error {
  readonly audit: MahjongOwnershipAudit

  constructor(audit: MahjongOwnershipAudit) {
    super(
      `Mahjong ownership is not conserved: duplicates=${issueIds(audit.duplicates)}; `
      + `missing=${audit.missing.join(', ') || 'none'}; `
      + `unknown=${issueIds(audit.unknown)}; `
      + `universeDuplicates=${audit.duplicateUniverseIds.join(', ') || 'none'}`
    )
    this.name = 'MahjongOwnershipError'
    this.audit = audit
  }
}

export function assertMahjongOwnership(
  snapshot: MahjongOwnershipSnapshot
): MahjongOwnershipAudit {
  const audit = auditMahjongOwnership(snapshot)
  if (!audit.conserved) throw new MahjongOwnershipError(audit)
  return audit
}
