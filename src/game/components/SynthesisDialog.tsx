import { useState } from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  HammerIcon,
  PlusIcon,
  XIcon
} from '@phosphor-icons/react'
import type { SpecialTowerType, Tower } from '../types/game'
import {
  GEM_NAMES,
  LEVEL_NAMES,
  SPECIAL_TOWER_NAMES,
  SPECIAL_TOWER_RECIPES
} from '../config/towers'
import {
  findSpecialSynthesisMaterials,
  findSynthesisPairsAtTower
} from '../engine/synthesis'
import {
  SPECIAL_TOWER_SPRITES,
  getTowerSpriteUrl
} from '../rendering/spriteRegistry'

interface SynthesisDialogProps {
  fieldTowers: Tower[]
  selectedTowerId: string
  canSynthesize: boolean
  onSynthesize: (towerId1: string, towerId2: string) => boolean
  onSynthesizeSpecial?: (specialType: SpecialTowerType) => boolean
  onClose: () => void
}

const getNextLevelName = (level: 'chipped' | 'flawed' | 'normal') => {
  if (level === 'chipped') return LEVEL_NAMES.flawed
  if (level === 'flawed') return LEVEL_NAMES.normal
  return LEVEL_NAMES.flawless
}

function getTowerName(tower: Tower) {
  if (tower.specialType) return SPECIAL_TOWER_NAMES[tower.specialType]
  if (tower.gemType) return `${GEM_NAMES[tower.gemType]} ${LEVEL_NAMES[tower.level]}`
  return '未知塔'
}

export function SynthesisDialog({
  fieldTowers,
  selectedTowerId,
  canSynthesize,
  onSynthesize,
  onSynthesizeSpecial,
  onClose
}: SynthesisDialogProps) {
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null)
  const selectedFieldTower = fieldTowers.find(tower => tower.id === selectedTowerId)
  const pairs = findSynthesisPairsAtTower(fieldTowers, selectedTowerId)
  const specialTowerTypes = Object.keys(SPECIAL_TOWER_RECIPES) as SpecialTowerType[]

  const completeSynthesis = (successful: boolean) => {
    if (!successful) return
    setSelectedPair(null)
    onClose()
  }

  return (
    <div className="synthesis-dialog-backdrop" role="presentation">
      <section className="synthesis-dialog" role="dialog" aria-modal="true" aria-labelledby="synthesis-title">
        <header className="synthesis-dialog__header">
          <h2 id="synthesis-title"><HammerIcon weight="fill" />合成列表</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭合成列表">
            <XIcon weight="bold" />
          </button>
        </header>

        {!canSynthesize && (
          <p className="synthesis-dialog__notice">
            波次进行中：当前仅可查看合成列表，合成将在备战阶段开放。
          </p>
        )}

        {selectedFieldTower && (
          <div className="synthesis-dialog__anchor">
            {getTowerSpriteUrl(selectedFieldTower) && (
              <img src={getTowerSpriteUrl(selectedFieldTower)!} alt="" />
            )}
            <span>
              当前选中场上塔
              <strong>{getTowerName(selectedFieldTower)}</strong>
              <small>合成塔将保留在该塔位置</small>
            </span>
          </div>
        )}

        <section className="synthesis-section">
          <h3>特殊塔配方</h3>
          <div className="synthesis-dialog__special-grid">
            {specialTowerTypes.map(type => {
              const recipe = SPECIAL_TOWER_RECIPES[type]
              const [firstGem, secondGem] = recipe.requiredGems
              const available = findSpecialSynthesisMaterials(fieldTowers, type, selectedTowerId) !== null
              return (
                <article className={`special-recipe${available ? ' special-recipe--available' : ''}`} key={type}>
                  <img src={SPECIAL_TOWER_SPRITES[type]} alt="" />
                  <strong>{SPECIAL_TOWER_NAMES[type]}</strong>
                  <span>{GEM_NAMES[firstGem]} + {GEM_NAMES[secondGem]}</span>
                  <small>{recipe.description}</small>
                  {available && onSynthesizeSpecial && canSynthesize ? (
                    <button
                      type="button"
                      onClick={() => completeSynthesis(onSynthesizeSpecial(type))}
                    >
                      <HammerIcon weight="fill" />合成{SPECIAL_TOWER_NAMES[type]}
                    </button>
                  ) : (
                    <em>{available ? '材料已集齐，战斗结束后可合成' : '材料不足'}</em>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        <section className="synthesis-section">
          <h3>可合成的塔对 ({pairs.length})</h3>
          {pairs.length === 0 ? (
            <div className="synthesis-empty">
              暂无可合成塔对
              <small>需要两座相同类型、相同品质的基础塔。</small>
              <small>当前场上有 {fieldTowers.length} 个可合成塔。</small>
            </div>
          ) : (
            <div className="synthesis-dialog__pair-grid">
              {pairs.map(([firstTower, secondTower]) => {
                const selected = selectedPair?.[0] === firstTower.id && selectedPair[1] === secondTower.id
                return (
                  <button
                    type="button"
                    className={`synthesis-pair${selected ? ' synthesis-pair--selected' : ''}`}
                    key={`${firstTower.id}:${secondTower.id}`}
                    disabled={!canSynthesize}
                    onClick={() => setSelectedPair([firstTower.id, secondTower.id])}
                  >
                    <img src={getTowerSpriteUrl(firstTower)!} alt="" />
                    <PlusIcon weight="bold" />
                    <img src={getTowerSpriteUrl(secondTower)!} alt="" />
                    <ArrowRightIcon weight="bold" />
                    <span>{getNextLevelName(firstTower.level)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {canSynthesize && selectedPair && (
          <button
            type="button"
            className="synthesis-dialog__confirm"
            onClick={() => completeSynthesis(onSynthesize(selectedPair[0], selectedPair[1]))}
          >
            <CheckIcon weight="bold" />确认合成
          </button>
        )}
      </section>
    </div>
  )
}
