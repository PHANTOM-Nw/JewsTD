import type {
  EnemyType,
  GemType,
  SpecialTowerType,
  Tower
} from '../types/game'
import amethystUrl from '../assets/towers/amethyst.png'
import diamondUrl from '../assets/towers/diamond.png'
import emeraldUrl from '../assets/towers/emerald.png'
import obsidianUrl from '../assets/towers/obsidian.png'
import opalUrl from '../assets/towers/opal.png'
import rubyUrl from '../assets/towers/ruby.png'
import sapphireUrl from '../assets/towers/sapphire.png'
import topazUrl from '../assets/towers/topaz.png'
import specialAgateUrl from '../assets/towers/special-agate.png'
import specialJadeUrl from '../assets/towers/special-jade.png'
import specialMalachiteUrl from '../assets/towers/special-malachite.png'
import specialMoonstoneUrl from '../assets/towers/special-moonstone.png'
import specialSilverUrl from '../assets/towers/special-silver.png'
import specialStarRubyUrl from '../assets/towers/special-star-ruby.png'
import basicEnemyUrl from '../assets/enemies/basic.png'
import bossEnemyUrl from '../assets/enemies/boss.png'
import fastEnemyUrl from '../assets/enemies/fast.png'
import tankEnemyUrl from '../assets/enemies/tank.png'
import entranceUrl from '../assets/gates/entrance.png'
import exitUrl from '../assets/gates/exit.png'
import crystalClusterUrl from '../assets/obstacles/crystal-cluster.png'
import runeBoulderUrl from '../assets/obstacles/rune-boulder.png'
import shardCairnUrl from '../assets/obstacles/shard-cairn.png'
import stackedStonesUrl from '../assets/obstacles/stacked-stones.png'
import stumpUrl from '../assets/obstacles/stump.png'
import creamStoneCellUrl from '../assets/tiles/cream-stone-cell.png'

export const BASE_TOWER_SPRITES: Record<GemType, string> = {
  amethyst: amethystUrl,
  diamond: diamondUrl,
  topaz: topazUrl,
  opal: opalUrl,
  ruby: rubyUrl,
  sapphire: sapphireUrl,
  emerald: emeraldUrl,
  obsidian: obsidianUrl
}

export const SPECIAL_TOWER_SPRITES: Record<SpecialTowerType, string> = {
  silver: specialSilverUrl,
  malachite: specialMalachiteUrl,
  starRuby: specialStarRubyUrl,
  moonstone: specialMoonstoneUrl,
  jade: specialJadeUrl,
  onyx: specialAgateUrl
}

export const ENEMY_SPRITES: Record<EnemyType, string> = {
  basic: basicEnemyUrl,
  fast: fastEnemyUrl,
  tank: tankEnemyUrl,
  boss: bossEnemyUrl
}

export const GATE_SPRITES = {
  entrance: entranceUrl,
  exit: exitUrl
} as const

export const OBSTACLE_SPRITES = [
  stackedStonesUrl,
  runeBoulderUrl,
  shardCairnUrl,
  stumpUrl,
  crystalClusterUrl
] as const

export const TILE_SPRITE = creamStoneCellUrl

export const ALL_SPRITE_URLS = Array.from(new Set([
  ...Object.values(BASE_TOWER_SPRITES),
  ...Object.values(SPECIAL_TOWER_SPRITES),
  ...Object.values(ENEMY_SPRITES),
  ...Object.values(GATE_SPRITES),
  ...OBSTACLE_SPRITES,
  TILE_SPRITE
]))

const imageCache = new Map<string, HTMLImageElement>()

export function getTowerSpriteUrl(
  tower: Pick<Tower, 'gemType' | 'specialType'>
): string | null {
  if (tower.specialType) return SPECIAL_TOWER_SPRITES[tower.specialType]
  if (tower.gemType) return BASE_TOWER_SPRITES[tower.gemType]
  return null
}

export function getObstacleSpriteUrl(row: number, col: number): string {
  const index = Math.abs((row * 31 + col * 17) % OBSTACLE_SPRITES.length)
  return OBSTACLE_SPRITES[index]
}

export function resolveSprite(url: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null

  let image = imageCache.get(url)
  if (!image) {
    image = new Image()
    image.decoding = 'async'
    image.src = url
    imageCache.set(url, image)
  }

  return image.complete && image.naturalWidth > 0 ? image : null
}

export function preloadSpriteAssets(): void {
  ALL_SPRITE_URLS.forEach(resolveSprite)
}
