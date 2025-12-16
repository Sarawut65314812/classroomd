// Sound management utility
class AudioManager {
  private enabled: boolean = true
  private audioCache: Map<string, HTMLAudioElement> = new Map()
  private backgroundMusic: HTMLAudioElement | null = null
  private bgMusicEnabled: boolean = true

  constructor() {
    this.preloadSounds()
    this.loadBackgroundMusic()
  }

  private preloadSounds() {
    // Preload เสียงเพื่อให้เล่นได้ทันที
    this.loadSound('correct', '/sounds/correct.wav')
    this.loadSound('fail', '/sounds/fail.wav')
    this.loadSound('endgame', '/sounds/endgame.wav')
  }

  private loadBackgroundMusic() {
    try {
      this.backgroundMusic = new Audio('/sounds/Background.mp3')
      this.backgroundMusic.loop = true
      this.backgroundMusic.volume = 0.15 // เสียงเบาๆ 15%
      this.backgroundMusic.preload = 'auto'
    } catch (error) {
      console.warn('Failed to load background music:', error)
    }
  }

  private loadSound(key: string, path: string) {
    try {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = 0.5
      this.audioCache.set(key, audio)
    } catch (error) {
      console.warn(`Failed to load sound: ${key}`, error)
    }
  }

  private playSound(key: string, volume: number = 0.5) {
    if (!this.enabled) return

    const audio = this.audioCache.get(key)
    if (!audio) {
      console.warn(`Sound not found: ${key}`)
      return
    }

    // Clone audio เพื่อให้เล่นซ้อนกันได้
    const sound = audio.cloneNode() as HTMLAudioElement
    sound.volume = volume
    sound.play().catch(err => {
      console.warn('Audio play failed:', err)
    })
  }

  playClick() {
    this.playSound('click', 0.3)
  }

  playCorrect() {
    this.playSound('correct', 0.5)
  }

  playFail() {
    this.playSound('fail', 0.4)
  }

  playEndgame() {
    this.playSound('endgame', 0.6)
  }

  // Aliases สำหรับ backward compatibility
  playSuccess() {
    this.playCorrect()
  }

  playApplause() {
    this.playEndgame()
  }

  playError() {
    this.playFail()
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  // Background Music Controls
  playBackgroundMusic() {
    if (!this.bgMusicEnabled || !this.backgroundMusic) return
    
    this.backgroundMusic.play().catch(err => {
      console.warn('Background music play failed:', err)
    })
  }

  pauseBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause()
    }
  }

  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause()
      this.backgroundMusic.currentTime = 0
    }
  }

  setBackgroundVolume(volume: number) {
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = Math.max(0, Math.min(1, volume))
    }
  }

  toggleBackgroundMusic() {
    this.bgMusicEnabled = !this.bgMusicEnabled
    if (this.bgMusicEnabled) {
      this.playBackgroundMusic()
    } else {
      this.pauseBackgroundMusic()
    }
    return this.bgMusicEnabled
  }

  isBackgroundMusicPlaying(): boolean {
    return this.backgroundMusic ? !this.backgroundMusic.paused : false
  }
}

export const audioManager = new AudioManager()
