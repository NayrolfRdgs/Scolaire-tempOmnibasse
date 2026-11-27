// ============================================================
// audioSynthesizer.ts — Lecteur de Samples WAV avec VRAIS Rhodes Mark I & Mark II
// ============================================================

export interface SoundBank {
  id: string
  name: string
  desc: string
}

export const SOUND_BANKS: SoundBank[] = [
  { id: 'rhodes-mark1', name: 'Fender Rhodes Mark I (Réel)', desc: 'Véritable 1977 Stage 73, chaud & boisé' },
  { id: 'rhodes-mark2', name: 'Fender Rhodes Mark II (Réel)', desc: 'Attaque franche, brillance & cloche tine' },
  { id: 'bass-electric', name: 'Basse Électrique Longue', desc: 'Sustain long & riche en harmoniques' },
  { id: 'sub-808', name: 'Sub-Basse 808 Longue', desc: 'Basses profondes trap/electro' },
  { id: 'omnichord', name: 'Omnichord Rétro', desc: 'Synthé vintage chaleureux' },
  { id: 'fretless', name: 'Basse Fretless Longue', desc: 'Texture jazz avec vibrato expressif' },
  { id: 'synth-direct', name: 'Synthé Pur (Direct)', desc: 'Génération temps réel' },
]

export const KEYS = [
  { label: 'Mi (E)', semitones: 0 },
  { label: 'Fa (F)', semitones: 1 },
  { label: 'Fa# (F#)', semitones: 2 },
  { label: 'Sol (G)', semitones: 3 },
  { label: 'Sol# (G#)', semitones: 4 },
  { label: 'La (A)', semitones: 5 },
  { label: 'La# (A#)', semitones: 6 },
  { label: 'Si (B)', semitones: 7 },
  { label: 'Do (C)', semitones: 8 },
  { label: 'Do# (C#)', semitones: 9 },
  { label: 'Ré (D)', semitones: 10 },
  { label: 'Ré# (D#)', semitones: 11 },
]

const BASE_FREQS = [98.0, 73.42, 55.0, 41.2] // G2, D2, A1, E1
const PENTA_SEMITONES = [0, 3, 5, 7, 10, 12, 15]

interface ActiveVoice {
  stringIdx: number
  currentSection: number
  source?: AudioBufferSourceNode
  osc1?: OscillatorNode
  osc2?: OscillatorNode
  subOsc?: OscillatorNode
  gainNode: GainNode
}

class BrowserAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private boosterGain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private compressor: DynamicsCompressorNode | null = null

  private sampleBuffers: Map<string, AudioBuffer> = new Map()
  private activeVoices: Map<number, ActiveVoice> = new Map()

  public volume: number = 0.6
  public filterCutoff: number = 6000
  public currentBank: string = 'rhodes-mark1'
  public keyOffset: number = 0

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()

      this.compressor = this.ctx.createDynamicsCompressor()
      this.compressor.threshold.setValueAtTime(-2, this.ctx.currentTime)
      this.compressor.knee.setValueAtTime(6, this.ctx.currentTime)
      this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime)
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime)
      this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime)

      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume

      this.boosterGain = this.ctx.createGain()
      this.boosterGain.gain.value = 1.3

      this.filter = this.ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = this.filterCutoff
      this.filter.Q.value = 1.2

      this.masterGain.connect(this.boosterGain)
      this.boosterGain.connect(this.filter)
      this.filter.connect(this.compressor)
      this.compressor.connect(this.ctx.destination)

      this.preloadBank(this.currentBank)
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  public async preloadBank(bankId: string) {
    if (bankId === 'synth-direct') return
    this.ensureContext()
    if (!this.ctx) return

    for (let s = 0; s < 4; s++) {
      for (let sec = 0; sec < 6; sec++) {
        const key = `${bankId}:${s}_${sec}`
        if (this.sampleBuffers.has(key)) continue

        const url = `/samples/${bankId}/${s}_${sec}.wav`
        fetch(url)
          .then(res => (res.ok ? res.arrayBuffer() : null))
          .then(async buf => {
            if (buf && this.ctx) {
              const audioBuf = await this.ctx.decodeAudioData(buf)
              this.sampleBuffers.set(key, audioBuf)
            }
          })
          .catch(() => {})
      }
    }
  }

  public setBank(bankId: string) {
    this.currentBank = bankId
    this.preloadBank(bankId)
  }

  public setKey(semitones: number) {
    this.keyOffset = semitones
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(2.0, val))
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03)
    }
  }

  public setFilter(val: number) {
    this.filterCutoff = 150 * Math.pow(60, val)
    if (this.filter && this.ctx) {
      this.filter.frequency.setTargetAtTime(this.filterCutoff, this.ctx.currentTime, 0.03)
    }
  }

  public resetAllSettings() {
    this.volume = 0.6
    this.filterCutoff = 6000
    this.currentBank = 'rhodes-mark1'
    this.keyOffset = 0
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0.6, this.ctx.currentTime)
    }
    if (this.filter && this.ctx) {
      this.filter.frequency.setValueAtTime(6000, this.ctx.currentTime)
    }
    this.allNotesOff()
  }

  private getFreq(stringIdx: number, fractionalSection: number): number {
    const base = BASE_FREQS[stringIdx] ?? 55.0
    const secFloor = Math.floor(fractionalSection)
    const secCeil = Math.min(PENTA_SEMITONES.length - 1, secFloor + 1)
    const ratio = fractionalSection - secFloor

    const semi1 = PENTA_SEMITONES[Math.max(0, Math.min(PENTA_SEMITONES.length - 1, secFloor))]
    const semi2 = PENTA_SEMITONES[secCeil]
    const semitones = semi1 + (semi2 - semi1) * ratio + this.keyOffset
    return base * Math.pow(2, semitones / 12)
  }

  public noteOn(stringIdx: number, fractionalSection: number) {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    this.noteOff(stringIdx)

    const secIdx = Math.max(0, Math.min(5, Math.floor(fractionalSection)))
    const sampleKey = `${this.currentBank}:${stringIdx}_${secIdx}`
    const buffer = this.sampleBuffers.get(sampleKey)

    const now = this.ctx.currentTime
    const voiceGain = this.ctx.createGain()
    voiceGain.gain.setValueAtTime(0.001, now)
    voiceGain.gain.exponentialRampToValueAtTime(1.0, now + 0.015)
    voiceGain.connect(this.masterGain)

    if (buffer && this.currentBank !== 'synth-direct') {
      const source = this.ctx.createBufferSource()
      source.buffer = buffer

      const posFraction = fractionalSection - secIdx
      const playbackRate = Math.pow(2, (this.keyOffset + (posFraction - 0.5) * 0.8) / 12)
      source.playbackRate.setValueAtTime(playbackRate, now)

      source.connect(voiceGain)
      source.start(now)

      this.activeVoices.set(stringIdx, {
        stringIdx,
        currentSection: secIdx,
        source,
        gainNode: voiceGain,
      })
    } else {
      const freq = this.getFreq(stringIdx, fractionalSection)

      const osc1 = this.ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.setValueAtTime(freq, now)

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'square'
      osc2.frequency.setValueAtTime(freq * 1.002, now)

      const subOsc = this.ctx.createOscillator()
      subOsc.type = 'triangle'
      subOsc.frequency.setValueAtTime(freq / 2, now)

      osc1.connect(voiceGain)
      osc2.connect(voiceGain)
      subOsc.connect(voiceGain)

      osc1.start(now)
      osc2.start(now)
      subOsc.start(now)

      this.activeVoices.set(stringIdx, {
        stringIdx,
        currentSection: secIdx,
        osc1,
        osc2,
        subOsc,
        gainNode: voiceGain,
      })
    }
  }

  public noteSlide(stringIdx: number, fractionalSection: number) {
    if (!this.ctx) return
    const voice = this.activeVoices.get(stringIdx)
    if (!voice) {
      this.noteOn(stringIdx, fractionalSection)
      return
    }

    const newSecIdx = Math.max(0, Math.min(5, Math.floor(fractionalSection)))

    // Si on change de frette en glissant : déclenche immédiatement la frette suivante
    if (newSecIdx !== voice.currentSection) {
      this.noteOn(stringIdx, fractionalSection)
      return
    }

    const now = this.ctx.currentTime
    if (voice.source) {
      const posFraction = fractionalSection - newSecIdx
      const playbackRate = Math.pow(2, (this.keyOffset + (posFraction - 0.5) * 0.8) / 12)
      voice.source.playbackRate.setTargetAtTime(playbackRate, now, 0.02)
    } else if (voice.osc1) {
      const freq = this.getFreq(stringIdx, fractionalSection)
      voice.osc1.frequency.setTargetAtTime(freq, now, 0.02)
      if (voice.osc2) voice.osc2.frequency.setTargetAtTime(freq * 1.002, now, 0.02)
      if (voice.subOsc) voice.subOsc.frequency.setTargetAtTime(freq / 2, now, 0.02)
    }
  }

  public noteOff(stringIdx: number) {
    const voice = this.activeVoices.get(stringIdx)
    if (!voice || !this.ctx) return

    const now = this.ctx.currentTime
    voice.gainNode.gain.cancelScheduledValues(now)
    voice.gainNode.gain.setValueAtTime(Math.max(voice.gainNode.gain.value, 0.001), now)
    voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.20)

    setTimeout(() => {
      try {
        voice.source?.stop()
        voice.osc1?.stop()
        voice.osc2?.stop()
        voice.subOsc?.stop()
        voice.gainNode.disconnect()
      } catch {
        // Ignoré
      }
    }, 220)

    this.activeVoices.delete(stringIdx)
  }

  public allNotesOff() {
    for (const stringIdx of Array.from(this.activeVoices.keys())) {
      this.noteOff(stringIdx)
    }
  }
}

export const browserSynth = new BrowserAudioEngine()
