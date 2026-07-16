import {
  getMahjongTileName,
  MAHJONG_SUITS
} from '../config/mahjong'
import type { GridCell, MahjongNumberTile, Tower } from '../types/game'
import {
  getMahjongSuitMechanicLabel,
  getMahjongTowerComparisonLabel,
  getOriginalMahjongStats
} from './mahjongUiModel'
import { MahjongTile } from './MahjongTile'

interface MahjongActivationDecisionProps {
  towers: readonly Tower[]
  fieldTowers: readonly Tower[]
  fieldWalls: readonly GridCell[]
  selectedTowerId: string
  onSelect: (tower: Tower) => void
  onConfirm: (towerId: string) => void
}

function compareSuitRank(
  a: Pick<MahjongNumberTile, 'suit' | 'rank'>,
  b: Pick<MahjongNumberTile, 'suit' | 'rank'>
): number {
  const suitDelta = MAHJONG_SUITS.indexOf(a.suit) - MAHJONG_SUITS.indexOf(b.suit)
  return suitDelta !== 0 ? suitDelta : a.rank - b.rank
}

export function MahjongActivationDecision({
  towers,
  fieldTowers,
  fieldWalls,
  selectedTowerId,
  onSelect,
  onConfirm
}: MahjongActivationDecisionProps) {
  const selectedTower = towers.find(tower => tower.id === selectedTowerId)
  if (!selectedTower?.mahjongTile) return null

  const currentTowers = towers.filter((tower): tower is Tower => Boolean(tower.mahjongTile))
  const historyTowers = fieldTowers
    .filter((tower): tower is Tower => Boolean(tower.mahjongTile))
    .slice()
    .sort((a, b) => compareSuitRank(a.mahjongTile!, b.mahjongTile!))
  const tileWalls = fieldWalls
    .filter(wall => wall.mahjongWallKind === 'tile' && Boolean(wall.mahjongTile))
    .slice()
    .sort((a, b) => compareSuitRank(a.mahjongTile!, b.mahjongTile!))
  const fieldTotal = currentTowers.length + historyTowers.length + tileWalls.length

  return (
    <section
      className="tower-decision"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tower-decision-title"
    >
      <span className="tower-decision__eyebrow">三选一</span>
      <h2 id="tower-decision-title">选择要激活的牌</h2>

      <div className="tower-decision__choices">
        {towers.map(tower => {
          if (!tower.mahjongTile) return null
          const stats = getOriginalMahjongStats(tower)
          const isSelected = tower.id === selectedTower.id
          const name = getMahjongTileName(tower.mahjongTile)
          return (
            <button
              key={tower.id}
              type="button"
              className={`tower-choice${isSelected ? ' tower-choice--selected' : ''}`}
              onClick={() => onSelect(tower)}
              aria-pressed={isSelected}
              aria-label={`选择${name}作为激活牌；${getMahjongTowerComparisonLabel(tower)}`}
            >
              <MahjongTile tile={tower.mahjongTile} compact />
              <span>{name}</span>
              <small className="tower-choice__stats">
                <b>伤害 {stats.damage}</b>
                <b>间隔 {stats.attackIntervalMs}ms</b>
                <b>距离 {stats.attackRange}</b>
                <em>{getMahjongSuitMechanicLabel(tower)}</em>
              </small>
            </button>
          )
        })}
      </div>

      <div className="tower-decision__detail">
        <MahjongTile tile={selectedTower.mahjongTile} />
        <div>
          <strong>{getMahjongTileName(selectedTower.mahjongTile)}</strong>
          <span>激活后保留在场上</span>
          <small>{getMahjongTowerComparisonLabel(selectedTower)}</small>
        </div>
      </div>

      <button
        type="button"
        className="tower-decision__confirm"
        onClick={() => onConfirm(selectedTower.id)}
      >
        激活此牌
      </button>

      <details className="tower-decision__field">
        <summary>场上牌面（{fieldTotal}）</summary>
        <div className="tower-decision__field-tiles">
          {currentTowers.map(tower => (
            <span key={tower.id} className="field-tile field-tile--current">
              <MahjongTile tile={tower.mahjongTile!} compact />
            </span>
          ))}
          {historyTowers.map(tower => (
            <span key={tower.id} className="field-tile">
              <MahjongTile tile={tower.mahjongTile!} compact />
            </span>
          ))}
          {tileWalls.map(wall => (
            <span key={`${wall.row}:${wall.col}`} className="field-tile field-tile--wall">
              <MahjongTile tile={wall.mahjongTile!} compact />
              <span className="field-tile__wall-mark">墙</span>
            </span>
          ))}
        </div>
      </details>

      <p className="tower-decision__hint">
        其余 2 张保留完整牌面并原地成为牌墙，继续改变敌人路线。
      </p>
    </section>
  )
}
