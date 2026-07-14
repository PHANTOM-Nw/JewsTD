import { findSynthesizableTowerPairs, getTowerStats, SPECIAL_TOWER_RECIPES } from '../config/towers'
import type { GemLevel, SpecialTowerType, Tower } from '../types/game'

/**
 * 只返回包含玩家所选场上塔的普通合成组合，并把所选塔放在首位。
 * 首位材料是合成结果保留的位置。
 */
export function findSynthesisPairsAtTower(
  fieldTowers: readonly Tower[],
  selectedTowerId: string
) {
  return findSynthesizableTowerPairs(fieldTowers)
    .filter(pair => pair.some(tower => tower.id === selectedTowerId))
    .map(([firstTower, secondTower]) => firstTower.id === selectedTowerId
      ? [firstTower, secondTower] as const
      : [secondTower, firstTower] as const)
}

/**
 * 按配方选取特殊塔材料，所选场上塔固定为首位和合成落点。
 */
export function findSpecialSynthesisMaterials(
  fieldTowers: readonly Tower[],
  specialType: SpecialTowerType,
  selectedTowerId: string
): Tower[] | null {
  const selectedTower = fieldTowers.find(tower => tower.id === selectedTowerId)
  if (!selectedTower?.gemType || selectedTower.specialType) {
    return null
  }

  const remainingGemTypes = [...SPECIAL_TOWER_RECIPES[specialType].requiredGems]
  const selectedGemIndex = remainingGemTypes.indexOf(selectedTower.gemType)
  if (selectedGemIndex === -1) {
    return null
  }

  remainingGemTypes.splice(selectedGemIndex, 1)
  const availableTowers = fieldTowers.filter(tower => tower.id !== selectedTowerId)
  const materials = [selectedTower]

  for (const gemType of remainingGemTypes) {
    const materialIndex = availableTowers.findIndex(tower => (
      tower.gemType === gemType && !tower.specialType
    ))
    if (materialIndex === -1) {
      return null
    }

    materials.push(availableTowers[materialIndex])
    availableTowers.splice(materialIndex, 1)
  }

  return materials
}

/** 创建升级塔，同时保留玩家所选塔的 ID 和场上位置。 */
export function createUpgradedTowerAtAnchor(
  selectedTower: Tower,
  newLevel: GemLevel
): Tower | null {
  if (!selectedTower.gemType || selectedTower.specialType) {
    return null
  }

  const stats = getTowerStats(selectedTower.gemType, newLevel)
  return {
    ...selectedTower,
    ...stats,
    level: newLevel
  }
}

/** 创建特殊塔，同时保留玩家所选塔的 ID 和场上位置。 */
export function createSpecialTowerAtAnchor(
  selectedTower: Tower,
  specialType: SpecialTowerType
): Tower {
  const recipe = SPECIAL_TOWER_RECIPES[specialType]

  return {
    ...selectedTower,
    ...recipe.stats,
    gemType: undefined,
    specialType,
    level: recipe.level,
    lastAttackTime: 0
  }
}
