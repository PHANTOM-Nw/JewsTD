import type { CSSProperties } from 'react'
import { getMahjongTileName } from '../config/mahjong'
import { MAP_CONFIG } from '../config/map'
import type { Tower } from '../types/game'
import {
  getMahjongAbilitySummary,
  MAHJONG_FORMATION_LABELS
} from './mahjongUiModel'
import { getBoardRangeOverlayStyle } from './boardOverlay'

interface MahjongTowerInspectionProps {
  tower: Tower
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits,
    useGrouping: false
  })
}

function getBubblePlacement(tower: Tower): {
  className: string
  style: CSSProperties
} {
  const horizontal = tower.gridPosition.col <= 2
    ? 'left'
    : tower.gridPosition.col >= MAP_CONFIG.cols - 3
      ? 'right'
      : 'center'
  const vertical = tower.gridPosition.row < MAP_CONFIG.rows / 2 ? 'below' : 'above'
  const boardWidth = MAP_CONFIG.cols * MAP_CONFIG.cellSize
  const boardHeight = MAP_CONFIG.rows * MAP_CONFIG.cellSize

  return {
    className: `mahjong-tower-inspection__bubble mahjong-tower-inspection__bubble--${horizontal} mahjong-tower-inspection__bubble--${vertical}`,
    style: {
      left: `${(tower.position.x / boardWidth) * 100}%`,
      top: `${(tower.position.y / boardHeight) * 100}%`
    }
  }
}

/**
 * 纯展示覆盖层：范围圈使用战斗实际的 tower.range，气泡显示写入 Tower 的
 * 基础面板值。中与發等不写回基础面板的效果单独列在能力摘要中。
 */
export function MahjongTowerInspection({ tower }: MahjongTowerInspectionProps) {
  const state = tower.mahjongState
  const name = tower.mahjongTile ? getMahjongTileName(tower.mahjongTile) : '棋子'
  const formation = state ? MAHJONG_FORMATION_LABELS[state.formation] : '未知牌型'
  const abilities = state
    ? getMahjongAbilitySummary(state)
    : [tower.damageType === 'magic'
        ? '魔法伤害'
        : tower.damageType === 'pure'
          ? '纯粹伤害'
          : '物理伤害']
  const bubble = getBubblePlacement(tower)

  return (
    <div className="mahjong-tower-inspection">
      <div
        className="mahjong-tower-inspection__range"
        style={getBoardRangeOverlayStyle(tower.position, tower.range)}
        aria-hidden="true"
      />
      <aside
        className={bubble.className}
        style={bubble.style}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>{name} · {formation}</strong>
        <dl className="mahjong-tower-inspection__stats">
          <div>
            <dt>伤害</dt>
            <dd>{formatNumber(tower.damage, 2)}</dd>
          </div>
          <div>
            <dt>攻击间隔</dt>
            <dd>{formatNumber(tower.attackSpeed, 0)}ms</dd>
          </div>
          <div>
            <dt>射程</dt>
            <dd>{formatNumber(tower.range, 2)}</dd>
          </div>
        </dl>
        <span className="mahjong-tower-inspection__ability-title">能力摘要</span>
        <ul>
          {abilities.map(ability => <li key={ability}>{ability}</li>)}
        </ul>
      </aside>
    </div>
  )
}
