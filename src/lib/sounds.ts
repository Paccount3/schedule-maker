export type SoundId =
  | 'select'
  | 'place'
  | 'pickup'
  | 'drop'
  | 'delete'
  | 'copy'
  | 'paste'
  | 'open'
  | 'celebrate'
  | 'bulk'
  | 'split'
  | 'weekNav'
  | 'warning'

export type SoundOption = SoundId | false

let audioContext: AudioContext | null = null
let unlockListenerAttached = false
let soundsFxEnabled = true

export function setSoundsFxEnabled(enabled: boolean): void {
  soundsFxEnabled = enabled
}

export function areSoundsFxEnabled(): boolean {
  return soundsFxEnabled
}

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

export function unlockAudio(): void {
  const ctx = getContext()
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
}

export function attachAudioUnlock(): void {
  if (unlockListenerAttached || typeof window === 'undefined') return
  unlockListenerAttached = true

  const unlock = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }

  window.addEventListener('pointerdown', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
}

function tone(
  frequency: number,
  startTime: number,
  duration: number,
  options: {
    type?: OscillatorType
    volume?: number
    attack?: number
    release?: number
    detune?: number
  } = {},
): void {
  const ctx = getContext()
  const {
    type = 'sine',
    volume = 0.08,
    attack = 0.008,
    release = 0.06,
    detune = 0,
  } = options

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)
  oscillator.detune.setValueAtTime(detune, startTime)

  gain.gain.setValueAtTime(0.0001, startTime)
  gain.gain.exponentialRampToValueAtTime(volume, startTime + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + release)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration + release + 0.02)
}

function noiseBurst(startTime: number, duration: number, volume = 0.035): void {
  const ctx = getContext()
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration))
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    const envelope = 1 - i / bufferSize
    data[i] = (Math.random() * 2 - 1) * envelope
  }

  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()

  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(900, startTime)
  filter.Q.setValueAtTime(0.7, startTime)

  gain.gain.setValueAtTime(volume, startTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start(startTime)
  source.stop(startTime + duration + 0.02)
}

function playSelect(now: number): void {
  tone(880, now, 0.04, { volume: 0.05, type: 'triangle' })
}

function playPlace(now: number): void {
  tone(420, now, 0.05, { volume: 0.07, type: 'sine' })
  tone(620, now + 0.03, 0.06, { volume: 0.06, type: 'sine' })
}

function playPickup(now: number): void {
  tone(320, now, 0.04, { volume: 0.045, type: 'triangle' })
  tone(520, now + 0.02, 0.05, { volume: 0.04, type: 'triangle' })
}

function playDrop(now: number): void {
  tone(260, now, 0.07, { volume: 0.07, type: 'sine' })
  tone(180, now + 0.03, 0.08, { volume: 0.05, type: 'sine' })
}

function playDelete(now: number): void {
  tone(220, now, 0.08, { volume: 0.06, type: 'triangle' })
  tone(140, now + 0.04, 0.1, { volume: 0.05, type: 'triangle' })
}

function playCopy(now: number): void {
  tone(740, now, 0.035, { volume: 0.05, type: 'square' })
  tone(980, now + 0.05, 0.035, { volume: 0.045, type: 'square' })
}

function playPaste(now: number): void {
  tone(500, now, 0.04, { volume: 0.055, type: 'sine' })
  tone(700, now + 0.045, 0.05, { volume: 0.05, type: 'sine' })
  tone(860, now + 0.09, 0.04, { volume: 0.04, type: 'sine' })
}

function playOpen(now: number): void {
  tone(660, now, 0.035, { volume: 0.045, type: 'triangle' })
}

function playConfettiPop(now: number): void {
  noiseBurst(now, 0.035, 0.028)
  tone(880, now + 0.01, 0.05, { volume: 0.065, type: 'sine', release: 0.08 })
  tone(1175, now + 0.03, 0.045, { volume: 0.05, type: 'triangle', release: 0.07 })
}

function playCelebrate(_now: number): void {
  // Kept for SoundId map compatibility; celebration uses playConfettiPopSound().
}

function playBulk(now: number): void {
  tone(180, now, 0.09, { volume: 0.08, type: 'sine' })
  tone(440, now + 0.05, 0.07, { volume: 0.05, type: 'triangle' })
  tone(660, now + 0.1, 0.08, { volume: 0.045, type: 'triangle' })
}

function playSplit(now: number): void {
  noiseBurst(now, 0.05, 0.03)
  tone(360, now + 0.04, 0.05, { volume: 0.05, type: 'triangle' })
}

function playWeekNav(now: number): void {
  tone(420, now, 0.05, { volume: 0.04, type: 'sine' })
  tone(520, now + 0.04, 0.05, { volume: 0.035, type: 'sine' })
}

function playWarning(now: number): void {
  tone(740, now, 0.08, { volume: 0.055, type: 'triangle' })
  tone(554, now + 0.1, 0.1, { volume: 0.05, type: 'triangle' })
  tone(440, now + 0.2, 0.12, { volume: 0.045, type: 'sine' })
}

const PLAYERS: Record<SoundId, (now: number) => void> = {
  select: playSelect,
  place: playPlace,
  pickup: playPickup,
  drop: playDrop,
  delete: playDelete,
  copy: playCopy,
  paste: playPaste,
  open: playOpen,
  celebrate: playCelebrate,
  bulk: playBulk,
  split: playSplit,
  weekNav: playWeekNav,
  warning: playWarning,
}

let lastWarningPlayedAt = 0
const WARNING_SOUND_COOLDOWN_MS = 900

export function playConfettiPopSound(): void {
  if (!soundsFxEnabled) return
  try {
    unlockAudio()
    const ctx = getContext()
    playConfettiPop(ctx.currentTime + 0.001)
  } catch {
    // Ignore audio failures
  }
}

export function playWarningSound(): void {
  if (!soundsFxEnabled) return
  const now = Date.now()
  if (now - lastWarningPlayedAt < WARNING_SOUND_COOLDOWN_MS) return
  lastWarningPlayedAt = now
  playSound('warning')
}

export function playSound(id: SoundId): void {
  if (!soundsFxEnabled) return
  try {
    unlockAudio()
    const ctx = getContext()
    const now = ctx.currentTime + 0.001
    PLAYERS[id](now)
  } catch {
    // Ignore audio failures (unsupported browser, blocked context, etc.)
  }
}

export function playSoundOption(option: SoundOption | undefined, fallback: SoundId): void {
  if (option === false) return
  playSound(option ?? fallback)
}
