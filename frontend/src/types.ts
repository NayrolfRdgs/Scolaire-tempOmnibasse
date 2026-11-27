// ============================================================
// types.ts — Contrat API Omnibasse (miroir du backend Pydantic)
// ============================================================

export type TouchState = 'down' | 'move' | 'up'
export type TouchSource = 'hardware' | 'simulator'

export interface TouchEvent {
  type: 'touch'
  state: TouchState
  string: number      // 0-3 (corde)
  section: number     // 0-5 (section)
  pos: number         // 0.0-1.0 (position continue dans la section)
  pressure: number    // 0.0-1.0
  source: TouchSource
  t: number           // timestamp float
}

export interface PotEvent {
  type: 'pot'
  id: 'volume' | 'filter' | 'reverb' | 'bank' | 'key'
  value: number       // 0.0-1.0
  source: 'simulator'
  t: number
}

export type WsEvent = TouchEvent | PotEvent

// ---- Configuration complète ----

export interface StringConfig {
  id: number
  base_note: string   // ex: "E1"
}

export interface ScaleConfig {
  root: string        // ex: "E"
  mode: string        // ex: "minor_pentatonic_octave"
}

export interface TouchConfig {
  threshold: number   // ex: 12
  release: number     // ex: 6
  hysteresis: number  // ex: 0.05
}

export interface PotConfig {
  id: 'volume' | 'filter' | 'reverb' | 'bank' | 'key'
  channel: number
}

export interface SamplesConfig {
  bank: string        // ex: "bass-default"
}

export interface LayoutConfig {
  strings: number     // 4
  sections: number    // 6
}

export interface AppConfig {
  schema_version: 1
  layout: LayoutConfig
  strings: StringConfig[]
  scale: ScaleConfig
  play_mode: 'notes' | 'free'
  touch: TouchConfig
  pots: PotConfig[]
  samples: SamplesConfig
}

// ---- État serveur ----

export interface AppState {
  connected_clients: number
  hardware_mode: string
  audio_bank: string
  play_mode: string
}

// ---- Calibration ----

export interface CalibrationData {
  // canal (0-23) → valeur brute delta capacitif
  values: Record<number, number>
  max_values: Record<number, number>
}

// ---- Samples ----

export interface SamplesResponse {
  bank: string
  files: string[]  // chemins relatifs des fichiers WAV
}
