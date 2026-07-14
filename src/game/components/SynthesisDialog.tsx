import React, { useState } from 'react'
import type { SpecialTowerType, Tower } from '../types/game'
import {
  GEM_COLORS,
  GEM_NAMES,
  LEVEL_NAMES,
  SPECIAL_TOWER_NAMES,
  SPECIAL_TOWER_RECIPES
} from '../config/towers'
import {
  findSpecialSynthesisMaterials,
  findSynthesisPairsAtTower
} from '../engine/synthesis'

interface SynthesisDialogProps {
  fieldTowers: Tower[]
  selectedTowerId: string
  canSynthesize: boolean
  onSynthesize: (towerId1: string, towerId2: string) => boolean
  onSynthesizeSpecial?: (specialType: SpecialTowerType) => boolean
  onClose: () => void
}

const getNextLevelName = (level: 'chipped' | 'flawed' | 'normal') => {
  if (level === 'chipped') {
    return LEVEL_NAMES.flawed
  }

  if (level === 'flawed') {
    return LEVEL_NAMES.normal
  }

  return LEVEL_NAMES.flawless
}

export const SynthesisDialog: React.FC<SynthesisDialogProps> = ({
  fieldTowers,
  selectedTowerId,
  canSynthesize,
  onSynthesize,
  onSynthesizeSpecial,
  onClose
}) => {
  const [selectedTower1, setSelectedTower1] = useState<string | null>(null)
  const [selectedTower2, setSelectedTower2] = useState<string | null>(null)

  const selectedFieldTower = fieldTowers.find(tower => tower.id === selectedTowerId)
  const pairs = findSynthesisPairsAtTower(fieldTowers, selectedTowerId)
  const specialTowerTypes = Object.keys(SPECIAL_TOWER_RECIPES) as SpecialTowerType[]
  const specialTowers = specialTowerTypes.map(type => {
    const recipe = SPECIAL_TOWER_RECIPES[type]
    const [firstGem, secondGem] = recipe.requiredGems

    return {
      type,
      name: SPECIAL_TOWER_NAMES[type],
      recipe: `${GEM_NAMES[firstGem]} + ${GEM_NAMES[secondGem]}`,
      available: findSpecialSynthesisMaterials(fieldTowers, type, selectedTowerId) !== null,
      description: recipe.description
    }
  })

  const completeSynthesis = (successful: boolean) => {
    if (!successful) {
      return
    }

    setSelectedTower1(null)
    setSelectedTower2(null)
    onClose()
  }

  const handleSynthesize = () => {
    if (!canSynthesize || !selectedTower1 || !selectedTower2) {
      return
    }

    completeSynthesis(onSynthesize(selectedTower1, selectedTower2))
  }

  const handleSynthesizeSpecial = (specialType: SpecialTowerType) => {
    if (!canSynthesize || !onSynthesizeSpecial) {
      return
    }

    completeSynthesis(onSynthesizeSpecial(specialType))
  }

  return (
    <div className="synthesis-dialog-backdrop">
      <div className="synthesis-dialog">
        <div className="synthesis-dialog__header">
          <h2 style={{ margin: 0, color: '#333' }}>🔧 合成列表</h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: '#FF5722',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✕ 关闭
          </button>
        </div>

        {!canSynthesize && (
          <div style={{
            marginBottom: '20px',
            padding: '10px 12px',
            background: '#FFF3E0',
            border: '1px solid #FFB74D',
            borderRadius: '4px',
            color: '#E65100',
            fontSize: '13px'
          }}>
            波次进行中：当前仅可查看合成列表，合成操作将在备战阶段开放。
          </div>
        )}

        {selectedFieldTower && (
          <div style={{
            marginBottom: '20px',
            padding: '10px 12px',
            background: '#E3F2FD',
            border: '1px solid #90CAF9',
            borderRadius: '4px',
            color: '#0D47A1',
            fontSize: '13px'
          }}>
            当前选中场上塔：
            {selectedFieldTower.specialType
              ? SPECIAL_TOWER_NAMES[selectedFieldTower.specialType]
              : selectedFieldTower.gemType
                ? `${GEM_NAMES[selectedFieldTower.gemType]} ${LEVEL_NAMES[selectedFieldTower.level]}`
                : '未知塔'}。
            合成塔将保留在该塔位置。
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '16px' }}>
            🔮 特殊塔配方
          </h3>
          <div className="synthesis-dialog__special-grid">
            {specialTowers.map(tower => (
              <div
                key={tower.type}
                style={{
                  padding: '15px',
                  background: tower.available ? '#E8F5E9' : '#F5F5F5',
                  borderRadius: '4px',
                  border: tower.available ? '2px solid #4CAF50' : '2px solid #DDD',
                  opacity: tower.available ? 1 : 0.6,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '5px', fontSize: '16px' }}>
                  {tower.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  需要: {tower.recipe}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '10px' }}>
                  {tower.description}
                </div>

                {tower.available ? (
                  <div>
                    <div style={{ fontSize: '12px', color: '#4CAF50', marginBottom: '8px' }}>
                      ✓ 材料已集齐
                    </div>
                    {onSynthesizeSpecial && canSynthesize && (
                      <button
                        onClick={() => handleSynthesizeSpecial(tower.type)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={event => {
                          event.currentTarget.style.background = '#45a049'
                        }}
                        onMouseOut={event => {
                          event.currentTarget.style.background = '#4CAF50'
                        }}
                      >
                        🔧 合成{tower.name}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    材料不足
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '16px' }}>
            ⚡ 可合成的塔对 ({pairs.length})
          </h3>

          {pairs.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#999',
              background: '#F5F5F5',
              borderRadius: '4px'
            }}>
              暂无可合成的塔对<br />
              <small>需要2个相同类型和等级的基础塔</small>
              <br /><br />
              <strong>当前场上有 {fieldTowers.length} 个可合成塔:</strong>
              {fieldTowers.length > 0 ? (
                <ul style={{ textAlign: 'left', marginTop: '10px', paddingLeft: '20px' }}>
                  {fieldTowers.map(tower => (
                    <li key={tower.id} style={{ fontSize: '12px', marginBottom: '4px' }}>
                      {tower.specialType
                        ? SPECIAL_TOWER_NAMES[tower.specialType]
                        : tower.gemType
                          ? `${GEM_NAMES[tower.gemType]} ${LEVEL_NAMES[tower.level]}`
                          : '未知塔'} (ID: {tower.id.substring(0, 8)})
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '12px', marginTop: '10px' }}>场上暂无塔，请先保留一座塔</p>
              )}
            </div>
          ) : (
            <div className="synthesis-dialog__pair-grid">
              {pairs.map(([tower1, tower2]) => {
                const isSelected = selectedTower1 === tower1.id && selectedTower2 === tower2.id

                return (
                  <div
                    key={`${tower1.id}:${tower2.id}`}
                    onClick={() => {
                      if (!canSynthesize) return

                      setSelectedTower1(tower1.id)
                      setSelectedTower2(tower2.id)
                    }}
                    onMouseEnter={event => {
                      if (!canSynthesize) return

                      event.currentTarget.style.background = '#F5F5F5'
                    }}
                    onMouseLeave={event => {
                      if (!canSynthesize) return

                      event.currentTarget.style.background = isSelected ? '#E3F2FD' : 'white'
                    }}
                    style={{
                      padding: '10px',
                      background: isSelected ? '#E3F2FD' : 'white',
                      border: isSelected ? '2px solid #2196F3' : '2px solid #DDD',
                      borderRadius: '6px',
                      cursor: canSynthesize ? 'pointer' : 'default',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        background: GEM_COLORS[tower1.gemType],
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: tower1.gemType === 'diamond' ? '#333' : 'white',
                        border: '1px solid #666'
                      }}>
                        {tower1.level.substring(0, 1).toUpperCase()}
                      </div>

                      <span style={{ color: '#999' }}>+</span>

                      <div style={{
                        width: '30px',
                        height: '30px',
                        background: GEM_COLORS[tower2.gemType],
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: tower2.gemType === 'diamond' ? '#333' : 'white',
                        border: '1px solid #666'
                      }}>
                        {tower2.level.substring(0, 1).toUpperCase()}
                      </div>

                      <span style={{ flex: 1 }}></span>

                      <span style={{ fontSize: '12px', color: '#666' }}>
                        → {getNextLevelName(tower1.level)}
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {GEM_NAMES[tower1.gemType]} {LEVEL_NAMES[tower1.level]} x2
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {canSynthesize && selectedTower1 && selectedTower2 && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#FFF9C4',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            <button
              onClick={handleSynthesize}
              style={{
                padding: '12px 30px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              ✓ 确认合成
            </button>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              合成塔将保留在当前选中塔的位置，另一座材料塔将被消耗
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
