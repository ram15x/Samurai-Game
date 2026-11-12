export type Sound =
  | 'swing'
  | 'hit'
  | 'heavyHit'
  | 'block'
  | 'jump'
  | 'land'
  | 'ko'
  | 'round'
  | 'fight'
  | 'win'
  | 'select'

/**
 * Sound effects synthesised with the Web Audio API, so the game ships no audio files.
 */
export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private noise: AudioBuffer | null = null

  /** Browsers only allow audio after a user gesture, so call this from a click or key press. */
  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  play(sound: Sound): void {
    const ctx = this.ctx
    if (!ctx || this.muted || ctx.state !== 'running') return
    switch (sound) {
      case 'swing':
        return this.burst(0.12, 0.12, 2400, 600, 'bandpass')
      case 'hit':
        this.tone('square', 180, 60, 0.12, 0.2)
        return this.burst(0.08, 0.25, 1800, 400, 'lowpass')
      case 'heavyHit':
        this.tone('sawtooth', 140, 40, 0.22, 0.3)
        return this.burst(0.16, 0.35, 1400, 200, 'lowpass')
      case 'block':
        this.tone('triangle', 1500, 1100, 0.07, 0.15)
        return this.tone('square', 2300, 1900, 0.05, 0.05)
      case 'jump':
        return this.tone('square', 260, 520, 0.1, 0.06)
      case 'land':
        return this.burst(0.05, 0.1, 500, 150, 'lowpass')
      case 'ko':
        this.tone('sawtooth', 300, 40, 0.7, 0.3)
        return this.burst(0.4, 0.3, 1200, 100, 'lowpass')
      case 'round':
        return this.tone('square', 440, 440, 0.18, 0.1)
      case 'fight':
        this.tone('square', 660, 660, 0.1, 0.1)
        return this.tone('square', 880, 880, 0.3, 0.1, 0.1)
      case 'win':
        ;[523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.16, 0.1, i * 0.13))
        return
      case 'select':
        return this.tone('square', 700, 900, 0.06, 0.06)
    }
  }

  private tone(
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    volume: number,
    delay = 0,
  ): void {
    const ctx = this.ctx!
    const start = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + duration)
    gain.gain.setValueAtTime(volume, start)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration)
  }

  /** A short burst of filtered noise: whooshes and thumps. */
  private burst(
    duration: number,
    volume: number,
    from: number,
    to: number,
    filterType: BiquadFilterType,
  ): void {
    const ctx = this.ctx!
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const now = ctx.currentTime
    const src = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    src.buffer = this.noise
    filter.type = filterType
    filter.frequency.setValueAtTime(from, now)
    filter.frequency.exponentialRampToValueAtTime(to, now + duration)
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start(now)
    src.stop(now + duration)
  }
}
