/**
 * 宝石TD音效管理系统
 * 使用Web Audio API合成音效,无需外部音频文件
 */

class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true
  private volume: number = 0.3  // 默认音量30%
  
  // 音效缓存
  private sounds: Map<string, AudioBuffer> = new Map()
  
  constructor() {
    this.initAudioContext()
  }
  
  /**
   * 初始化AudioContext
   */
  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      console.log('✅ 音频系统初始化成功')
    } catch (error) {
      console.warn('❌ 浏览器不支持Web Audio API:', error)
    }
  }
  
  /**
   * 启用/禁用音效
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled
    console.log(`音效${enabled ? '已启用' : '已禁用'}`)
  }
  
  /**
   * 设置音量 (0-1)
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
  }
  
  /**
   * 播放音效
   */
  play(soundType: string) {
    if (!this.enabled || !this.audioContext) return
    
    const sound = this.getSound(soundType)
    if (!sound) return
    
    const source = this.audioContext.createBufferSource()
    source.buffer = sound
    
    const gainNode = this.audioContext.createGain()
    gainNode.gain.value = this.volume
    
    source.connect(gainNode)
    gainNode.connect(this.audioContext.destination)
    
    source.start(0)
  }
  
  /**
   * 获取或生成音效
   */
  private getSound(soundType: string): AudioBuffer | null {
    if (!this.audioContext) return null
    
    // 如果已缓存,直接返回
    if (this.sounds.has(soundType)) {
      return this.sounds.get(soundType)!
    }
    
    // 生成新音效
    const sound = this.generateSound(soundType)
    if (sound) {
      this.sounds.set(soundType, sound)
    }
    
    return sound
  }
  
  /**
   * 合成音效
   */
  private generateSound(soundType: string): AudioBuffer | null {
    if (!this.audioContext) return null
    
    const sampleRate = this.audioContext.sampleRate
    const duration = 0.2  // 200ms
    const frameCount = sampleRate * duration
    const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate)
    const data = buffer.getChannelData(0)
    
    switch (soundType) {
      case 'amethyst':  // 紫水晶 - 清脆高频"叮"
        this.generateCrystalSound(data, sampleRate, 800, 0.1)
        break
        
      case 'diamond':  // 钻石 - 快速连射"咻咻"
        this.generateRapidSound(data, sampleRate, 600, 0.05)
        break
        
      case 'topaz':  // 黄玉 - 低沉爆炸"轰"
        this.generateExplosionSound(data, sampleRate, 200, 0.15)
        break
        
      case 'opal':  // 蛋白石 - 柔和魔法"嗡"
        this.generateMagicSound(data, sampleRate, 400, 0.12)
        break
        
      case 'ruby':  // 红宝石 - 响亮暴击"砰"
        this.generateCritSound(data, sampleRate, 300, 0.18)
        break
        
      case 'sapphire':  // 蓝宝石 - 穿透"嗖"
        this.generatePierceSound(data, sampleRate, 500, 0.08)
        break
        
      case 'emerald':  // 翡翠 - 持续毒素"嘶嘶"
        this.generatePoisonSound(data, sampleRate, 350, 0.2)
        break
        
      case 'obsidian':  // 黑曜石 - 沉重眩晕"咚"
        this.generateStunSound(data, sampleRate, 150, 0.15)
        break
        
      case 'silver':  // 银塔 - 金属碰撞
        this.generateMetalSound(data, sampleRate, 700, 0.1)
        break
        
      case 'malachite':  // 孔雀石 - 混合爆炸+减速
        this.generateMixedSound(data, sampleRate, 250, 0.13)
        break
        
      case 'starRuby':  // 星红宝石 - 强烈爆破
        this.generatePowerfulSound(data, sampleRate, 280, 0.2)
        break
        
      case 'moonstone':  // 月长石 - 空灵魔法
        this.generateEtherealSound(data, sampleRate, 450, 0.12)
        break
        
      case 'jade':  // 玉石 - 持续控制
        this.generateControlSound(data, sampleRate, 320, 0.15)
        break
        
      case 'onyx':  // 玛瑙 - 终极爆发
        this.generateUltimateSound(data, sampleRate, 200, 0.25)
        break
        
      default:
        return null
    }
    
    return buffer
  }
  
  // ========== 音效生成器 ==========
  
  /**
   * 水晶声 - 高频正弦波
   * 用于: 紫水晶(amethyst)
   * 特征: 清脆、高频、快速衰减
   */
  private generateCrystalSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const envelope = Math.exp(-t * 30)  // 快速衰减
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.5
    }
  }
  
  /**
   * 连射声 - 多个短脉冲
   * 用于: 钻石(diamond)
   * 特征: 快速连续射击效果
   */
  private generateRapidSound(data: Float32Array, sampleRate: number, frequency: number, pulseDuration: number) {
    const pulses = 3  // 3个脉冲
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      const pulseIndex = Math.floor(t / pulseDuration)
      
      if (pulseIndex >= pulses) {
        data[i] = 0
        continue
      }
      
      const pulseT = t % pulseDuration
      const envelope = Math.exp(-pulseT * 50)
      data[i] = Math.sin(2 * Math.PI * frequency * pulseT) * envelope * 0.4
    }
  }
  
  /**
   * 爆炸声 - 低频噪音+衰减
   * 用于: 黄玉(topaz)
   * 特征: 低沉、爆炸感、带随机噪音
   */
  private generateExplosionSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const noise = Math.random() * 2 - 1
      const envelope = Math.exp(-t * 15)
      const tone = Math.sin(2 * Math.PI * frequency * t) * 0.3
      
      data[i] = (noise * 0.7 + tone) * envelope * 0.6
    }
  }
  
  /**
   * 魔法声 - 调制正弦波
   * 用于: 蛋白石(opal)
   * 特征: 柔和、频率调制、魔法感
   */
  private generateMagicSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const modulation = Math.sin(2 * Math.PI * 5 * t) * 50  // 5Hz调制
      const envelope = Math.exp(-t * 10)
      
      data[i] = Math.sin(2 * Math.PI * (frequency + modulation) * t) * envelope * 0.4
    }
  }
  
  /**
   * 暴击声 - 强冲击波
   * 用于: 红宝石(ruby)
   * 特征: 快速上升、响亮、冲击力
   */
  private generateCritSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const attack = Math.min(1, t * 100)  // 快速上升
      const decay = Math.exp(-t * 20)
      const envelope = attack * decay
      
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.8
    }
  }
  
  /**
   * 穿透声 - 滑音效果
   * 用于: 蓝宝石(sapphire)
   * 特征: 频率从低到高滑动
   */
  private generatePierceSound(data: Float32Array, sampleRate: number, startFreq: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const freqSlide = startFreq + (1000 - startFreq) * (t / duration)  // 频率上升
      const envelope = Math.exp(-t * 25)
      
      data[i] = Math.sin(2 * Math.PI * freqSlide * t) * envelope * 0.5
    }
  }
  
  /**
   * 毒素声 - 持续嘶嘶
   * 用于: 翡翠(emerald)
   * 特征: 持续噪音+低频音调
   */
  private generatePoisonSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const noise = Math.random() * 2 - 1
      const envelope = 1 - (t / duration)  // 线性衰减
      
      data[i] = noise * envelope * 0.3 + Math.sin(2 * Math.PI * frequency * t) * 0.2
    }
  }
  
  /**
   * 眩晕声 - 重低音
   * 用于: 黑曜石(obsidian)
   * 特征: 低频、沉重、缓慢衰减
   */
  private generateStunSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const envelope = Math.exp(-t * 8)
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.7
    }
  }
  
  /**
   * 金属声 - 高频谐波
   * 用于: 银塔(silver)
   * 特征: 多谐波叠加、金属质感
   */
  private generateMetalSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const envelope = Math.exp(-t * 35)
      const harmonics = 
        Math.sin(2 * Math.PI * frequency * t) * 0.5 +
        Math.sin(2 * Math.PI * frequency * 2 * t) * 0.3 +
        Math.sin(2 * Math.PI * frequency * 3 * t) * 0.2
      
      data[i] = harmonics * envelope * 0.4
    }
  }
  
  /**
   * 混合声 - 爆炸+魔法
   * 用于: 孔雀石(malachite)
   * 特征: 噪音与音调混合
   */
  private generateMixedSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const noise = Math.random() * 2 - 1
      const envelope = Math.exp(-t * 12)
      const tone = Math.sin(2 * Math.PI * frequency * t) * 0.4
      
      data[i] = (noise * 0.5 + tone) * envelope * 0.5
    }
  }
  
  /**
   * 强力声 - 超低频冲击
   * 用于: 星红宝石(starRuby)
   * 特征: 慢速上升、强力、持久
   */
  private generatePowerfulSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const attack = Math.min(1, t * 80)
      const decay = Math.exp(-t * 10)
      const envelope = attack * decay
      
      data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.9
    }
  }
  
  /**
   * 空灵声 - 高频泛音
   * 用于: 月长石(moonstone)
   * 特征: 空灵、泛音丰富、优雅
   */
  private generateEtherealSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const envelope = Math.exp(-t * 8)
      const shimmer = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.3
      
      data[i] = (Math.sin(2 * Math.PI * frequency * t) * 0.7 + shimmer) * envelope * 0.4
    }
  }
  
  /**
   * 控制声 - 中频持续
   * 用于: 玉石(jade)
   * 特征: 中频波动、持续感
   */
  private generateControlSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const envelope = 1 - (t / duration) * 0.5
      const wobble = Math.sin(2 * Math.PI * 8 * t) * 20
      
      data[i] = Math.sin(2 * Math.PI * (frequency + wobble) * t) * envelope * 0.5
    }
  }
  
  /**
   * 终极声 - 全频段爆发
   * 用于: 玛瑙(onyx)
   * 特征: 多频段叠加、最强音效
   */
  private generateUltimateSound(data: Float32Array, sampleRate: number, frequency: number, duration: number) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      if (t > duration) break
      
      const attack = Math.min(1, t * 60)
      const decay = Math.exp(-t * 6)
      const envelope = attack * decay
      
      const bass = Math.sin(2 * Math.PI * frequency * t) * 0.6
      const mid = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.3
      const high = Math.sin(2 * Math.PI * frequency * 4 * t) * 0.1
      
      data[i] = (bass + mid + high) * envelope * 0.8
    }
  }
}

// 导出单例
export const soundManager = new SoundManager()

// 导出类型
export type SoundType = 
  | 'amethyst' | 'diamond' | 'topaz' | 'opal' 
  | 'ruby' | 'sapphire' | 'emerald' | 'obsidian'
  | 'silver' | 'malachite' | 'starRuby' 
  | 'moonstone' | 'jade' | 'onyx'
