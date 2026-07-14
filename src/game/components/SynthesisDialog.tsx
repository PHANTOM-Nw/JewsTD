import React, { useState } from 'react'
import type { SpecialTowerType, Tower } from '../types/game'
import {
  canCraftSpecialTower,
  findSynthesizableTowerPairs,
  GEM_COLORS,
  GEM_NAMES,
  LEVEL_NAMES,
  SPECIAL_TOWER_NAMES,
  SPECIAL_TOWER_RECIPES
} from '../config/towers'

interface SynthesisDialogProps {
  storedTowers: Tower[]
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
  storedTowers,
  onSynthesize,
  onSynthesizeSpecial,
  onClose
}) => {
  const [selectedTower1, setSelectedTower1] = useState<string | null>(null)
  const [selectedTower2, setSelectedTower2] = useState<string | null>(null)

  const pairs = findSynthesizableTowerPairs(storedTowers)
  const specialTowerTypes = Object.keys(SPECIAL_TOWER_RECIPES) as SpecialTowerType[]
  const specialTowers = specialTowerTypes.map(type => {
    const recipe = SPECIAL_TOWER_RECIPES[type]
    const [firstGem, secondGem] = recipe.requiredGems

    return {
      type,
      name: SPECIAL_TOWER_NAMES[type],
      recipe: `${GEM_NAMES[firstGem]} + ${GEM_NAMES[secondGem]}`,
      available: canCraftSpecialTower(storedTowers, type),
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
    if (!selectedTower1 || !selectedTower2) {
      return
    }

    completeSynthesis(onSynthesize(selectedTower1, selectedTower2))
  }

  const handleSynthesizeSpecial = (specialType: SpecialTowerType) => {
    if (!onSynthesizeSpecial) {
      return
    }

    completeSynthesis(onSynthesizeSpecial(specialType))
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '10px',
          borderBottom: '2px solid #EEE'
        }}>
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

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '16px' }}>
            🔮 特殊塔配方
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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
                    {onSynthesizeSpecial && (
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
              <strong>当前存储区有 {storedTowers.length} 个塔:</strong>
              {storedTowers.length > 0 ? (
                <ul style={{ textAlign: 'left', marginTop: '10px', paddingLeft: '20px' }}>
                  {storedTowers.map(tower => (
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
                <p style={{ fontSize: '12px', marginTop: '10px' }}>存储区为空,请先保留一些塔</p>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
              {pairs.map(([tower1, tower2]) => {
                const isSelected = selectedTower1 === tower1.id && selectedTower2 === tower2.id

                return (
                  <div
                    key={`${tower1.id}:${tower2.id}`}
                    onClick={() => {
                      setSelectedTower1(tower1.id)
                      setSelectedTower2(tower2.id)
                    }}
                    onMouseEnter={event => {
                      event.currentTarget.style.background = '#F5F5F5'
                    }}
                    onMouseLeave={event => {
                      event.currentTarget.style.background = isSelected ? '#E3F2FD' : 'white'
                    }}
                    style={{
                      padding: '10px',
                      background: isSelected ? '#E3F2FD' : 'white',
                      border: isSelected ? '2px solid #2196F3' : '2px solid #DDD',
                      borderRadius: '6px',
                      cursor: 'pointer',
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

        {selectedTower1 && selectedTower2 && (
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
              合成后第一个塔将升级为高级塔,第二个塔将被消耗
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
