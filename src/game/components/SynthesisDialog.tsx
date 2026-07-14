import React, { useState } from 'react'
import type { Tower, GemLevel, GemType, SpecialTowerType } from '../types/game'
import { GEM_COLORS, SPECIAL_TOWER_COLORS, GEM_NAMES, SPECIAL_TOWER_NAMES, LEVEL_NAMES } from '../config/towers'

interface SynthesisDialogProps {
  storedTowers: Tower[]
  onSynthesize: (towerId1: string, towerId2: string) => void
  onSynthesizeSpecial?: (specialType: SpecialTowerType) => void
  onClose: () => void
}



export const SynthesisDialog: React.FC<SynthesisDialogProps> = ({
  storedTowers,
  onSynthesize,
  onSynthesizeSpecial,  // 新增
  onClose
}) => {
  const [selectedTower1, setSelectedTower1] = useState<string | null>(null)
  const [selectedTower2, setSelectedTower2] = useState<string | null>(null)

  // 找出可合成的塔对(相同类型和等级)
  const findSynthesizablePairs = () => {
    const pairs: Array<[Tower, Tower]> = []
    const levels: GemLevel[] = ['chipped', 'flawed', 'normal']
    
    console.log('查找可合成的塔对,总塔数:', storedTowers.length)  // 调试
    
    levels.forEach(level => {
      const gemTypes: GemType[] = ['amethyst', 'diamond', 'topaz', 'opal']
      
      gemTypes.forEach(gemType => {
        const towersOfType = storedTowers.filter(
          t => t.gemType === gemType && t.level === level
        )
        
        console.log(`${gemType} ${level}:`, towersOfType.length, '个')  // 调试
        
        // 如果有至少2个相同类型和等级的塔,可以合成
        for (let i = 0; i < towersOfType.length - 1; i++) {
          for (let j = i + 1; j < towersOfType.length; j++) {
            pairs.push([towersOfType[i], towersOfType[j]])
            console.log(`找到可合成对: ${towersOfType[i].id} + ${towersOfType[j].id}`)  // 调试
          }
        }
      })
    })
    
    console.log('总共找到', pairs.length, '对可合成的塔')  // 调试
    return pairs
  }

  // 检查是否可以合成特殊塔
  const canCraftSpecialTower = () => {
    const hasDiamond = storedTowers.some(t => t.gemType === 'diamond')
    const hasTopaz = storedTowers.some(t => t.gemType === 'topaz')
    const hasOpal = storedTowers.some(t => t.gemType === 'opal')
    const hasAmethyst = storedTowers.some(t => t.gemType === 'amethyst')
    
    return [
      { 
        name: '银塔', 
        recipe: '钻石 + 黄玉', 
        type: 'silver',
        available: hasDiamond && hasTopaz,
        description: '多目标攻击 + 溅射伤害'
      },
      { 
        name: '孔雀石', 
        recipe: '黄玉 + 蛋白石', 
        type: 'malachite',
        available: hasTopaz && hasOpal,
        description: '溅射伤害 + 减速效果'
      },
      { 
        name: '星红宝石', 
        recipe: '紫水晶 + 钻石', 
        type: 'starRuby',
        available: hasAmethyst && hasDiamond,
        description: '纯粹伤害 + 多目标攻击'
      }
    ]
  }

  const handleSynthesize = () => {
    if (selectedTower1 && selectedTower2) {
      onSynthesize(selectedTower1, selectedTower2)
      setSelectedTower1(null)
      setSelectedTower2(null)
    }
  }

  const pairs = findSynthesizablePairs()
  const specialTowers = canCraftSpecialTower()

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
        {/* 标题栏 */}
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

        {/* 特殊塔配方 */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#666', fontSize: '16px' }}>
            🔮 特殊塔配方
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {specialTowers.map((tower, idx) => (
              <div
                key={idx}
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
                        onClick={() => {
                          console.log('点击合成特殊塔:', tower.type)
                          onSynthesizeSpecial!(tower.type as any)
                        }}
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
                        onMouseOver={(e) => e.currentTarget.style.background = '#45a049'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#4CAF50'}
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

        {/* 可合成的塔对 */}
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
              暂无可合成的塔对<br/>
              <small>需要2个相同类型和等级的塔</small>
              <br/><br/>
              <strong>当前存储区有 {storedTowers.length} 个塔:</strong>
              {storedTowers.length > 0 ? (
                <ul style={{ textAlign: 'left', marginTop: '10px', paddingLeft: '20px' }}>
                  {storedTowers.map(t => (
                    <li key={t.id} style={{ fontSize: '12px', marginBottom: '4px' }}>
                      {t.specialType 
                        ? SPECIAL_TOWER_NAMES[t.specialType] 
                        : `${GEM_NAMES[t.gemType || 'amethyst']} ${LEVEL_NAMES[t.level]}`} (ID: {t.id.substring(0, 8)})
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: '12px', marginTop: '10px' }}>存储区为空,请先保留一些塔</p>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
              {pairs.map(([tower1, tower2], idx) => {
                const isSelected = selectedTower1 === tower1.id && selectedTower2 === tower2.id
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      console.log('点击塔对:', tower1.id, tower2.id)  // 调试
                      setSelectedTower1(tower1.id)
                      setSelectedTower2(tower2.id)
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F5F5F5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isSelected ? '#E3F2FD' : 'white'
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
                      {/* 塔1图标 */}
                      <div style={{
                        width: '30px',
                        height: '30px',
                        background: tower1.specialType 
                          ? SPECIAL_TOWER_COLORS[tower1.specialType]
                          : GEM_COLORS[tower1.gemType || 'amethyst'],
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: tower1.gemType === 'diamond' || tower1.specialType === 'moonstone' ? '#333' : 'white',
                        border: '1px solid #666'
                      }}>
                        {tower1.level.substring(0, 1).toUpperCase()}
                      </div>
                      
                      <span style={{ color: '#999' }}>+</span>
                      
                      {/* 塔2图标 */}
                      <div style={{
                        width: '30px',
                        height: '30px',
                        background: tower2.specialType
                          ? SPECIAL_TOWER_COLORS[tower2.specialType]
                          : GEM_COLORS[tower2.gemType || 'amethyst'],
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        color: tower2.gemType === 'diamond' || tower2.specialType === 'moonstone' ? '#333' : 'white',
                        border: '1px solid #666'
                      }}>
                        {tower2.level.substring(0, 1).toUpperCase()}
                      </div>
                      
                      <span style={{ flex: 1 }}></span>
                      
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        → {LEVEL_NAMES[tower1.level === 'chipped' ? 'flawed' : tower1.level === 'flawed' ? 'normal' : 'flawless']}
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {tower1.specialType 
                        ? SPECIAL_TOWER_NAMES[tower1.specialType]
                        : `${GEM_NAMES[tower1.gemType || 'amethyst']} ${LEVEL_NAMES[tower1.level]}`} x2
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 合成按钮 */}
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
