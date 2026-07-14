import React, { useState } from 'react'
import type { Tower, SpecialTowerType } from '../types/game'
import { SPECIAL_TOWER_RECIPES, GEM_COLORS, SPECIAL_TOWER_COLORS, GEM_NAMES, SPECIAL_TOWER_NAMES, LEVEL_NAMES } from '../config/towers'

interface StoragePanelProps {
  storedTowers: Tower[]
  onSynthesize: (towerId1: string, towerId2: string) => void
}



export const StoragePanel: React.FC<StoragePanelProps> = ({
  storedTowers,
  onSynthesize
}) => {
  const [synthesisMode, setSynthesisMode] = useState(false)
  const [firstSelectedTower, setFirstSelectedTower] = useState<string | null>(null)

  const handleTowerClick = (towerId: string) => {
    if (!synthesisMode) {
      // 普通模式: 选择第一个塔进入合成模式
      setFirstSelectedTower(towerId)
      setSynthesisMode(true)
    } else {
      // 合成模式: 已选择第一个塔,现在选择第二个
      if (firstSelectedTower === towerId) {
        // 取消选择
        setFirstSelectedTower(null)
        setSynthesisMode(false)
      } else {
        // 尝试合成
        console.log(`尝试合成: ${firstSelectedTower} + ${towerId}`)
        if (onSynthesize && firstSelectedTower) {
          onSynthesize(firstSelectedTower, towerId)
        }
        setFirstSelectedTower(null)
        setSynthesisMode(false)
      }
    }
  }

  // 检查特殊塔配方
  const checkSpecialRecipes = () => {
    const recipes = Object.entries(SPECIAL_TOWER_RECIPES).map(([type, recipe]) => {
      const hasAllGems = recipe.requiredGems.every(gemType =>
        storedTowers.some(tower => tower.gemType === gemType)
      )
      return { type, canCraft: hasAllGems, ...recipe }
    })
    
    return recipes.filter(r => r.canCraft)
  }

  const availableRecipes = checkSpecialRecipes()

  return (
    <div style={{
      width: '250px',
      padding: '15px',
      background: '#F5F5F5',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      maxHeight: '600px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 15px 0', textAlign: 'center', color: '#333' }}>
        存储区 ({storedTowers.length})
      </h3>
      
      {storedTowers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          color: '#999',
          padding: '20px 0'
        }}>
          暂无存储的塔
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {storedTowers.map(tower => {
            const isSelected = firstSelectedTower === tower.id
            // 确定颜色
            let color: string
            if (tower.specialType) {
              color = SPECIAL_TOWER_COLORS[tower.specialType]
            } else if (tower.gemType) {
              color = GEM_COLORS[tower.gemType]
            } else {
              color = '#CCCCCC'
            }
            
            return (
              <div
                key={tower.id}
                onClick={() => handleTowerClick(tower.id)}
                style={{
                  padding: '10px',
                  background: isSelected ? (synthesisMode ? '#FFF9C4' : '#E3F2FD') : 'white',
                  border: isSelected ? '3px solid #FF9800' : '2px solid #DDD',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#90CAF9'
                    e.currentTarget.style.background = '#FAFAFA'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#DDD'
                    e.currentTarget.style.background = 'white'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* 宝石图标 */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: color,
                    borderRadius: '6px',
                    border: '2px solid #666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: tower.gemType === 'diamond' || tower.specialType === 'moonstone' ? '#333' : 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    flexShrink: 0
                  }}>
                    {tower.level.substring(0, 1).toUpperCase()}
                  </div>
                  
                  {/* 塔信息 */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '4px' }}>
                      {tower.specialType 
                        ? SPECIAL_TOWER_NAMES[tower.specialType] 
                        : (tower.gemType ? GEM_NAMES[tower.gemType] : '未知')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                      {LEVEL_NAMES[tower.level]}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      伤害:{tower.damage} 范围:{tower.range}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* 可合成的特殊塔提示 */}
      {availableRecipes.length > 0 && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          background: '#E8F5E9',
          borderRadius: '4px',
          border: '1px solid #4CAF50'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2E7D32', marginBottom: '5px' }}>
            ✨ 可合成特殊塔!
          </div>
          {availableRecipes.map(recipe => (
            <div key={recipe.type} style={{ fontSize: '12px', color: '#666' }}>
              • {SPECIAL_TOWER_NAMES[recipe.type as SpecialTowerType]}: {recipe.requiredGems.map(g => GEM_NAMES[g]).join(' + ')}
            </div>
          ))}
        </div>
      )}
      
      {/* 合成提示 */}
      {synthesisMode && firstSelectedTower && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: '#E3F2FD',
          borderRadius: '4px',
          fontSize: '14px',
          color: '#1976D2',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          已选择第1个塔,请选择第2个相同类型和等级的塔进行合成
          <button
            onClick={() => {
              setFirstSelectedTower(null)
              setSynthesisMode(false)
            }}
            style={{
              marginLeft: '10px',
              padding: '4px 8px',
              background: '#FF5722',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            取消
          </button>
        </div>
      )}
      
      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: '#FFF9C4',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        💡 点击两个相同类型和等级的塔进行合成升级
      </div>
    </div>
  )
}
