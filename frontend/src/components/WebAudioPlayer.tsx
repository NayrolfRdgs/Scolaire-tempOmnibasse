// ============================================================
// WebAudioPlayer.tsx — Lecture WebAudio des samples
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSamples } from '../api'
import type { WsEvent, TouchEvent as OmniTouchEvent } from '../types'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

// Notes de base des cordes (fréquences en Hz)
const STRING_BASE_FREQS = [98.0, 73.42, 55.0, 41.2] // G2, D2, A1, E1

// Gamme pentatonique mineure (intervalles en demi-tons depuis la tonique)
const PENTA_MINOR = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]

function sectionToFreq(stringIdx: number, sectionIdx: number, pos: number): number {
  const baseFreq = STRING_BASE_FREQS[stringIdx] ?? 55
  // pos dans la section : on interpole entre les deux demi-tons de la gamme
  const semitone = PENTA_MINOR[sectionIdx] ?? 0
  const nextSemitone = PENTA_MINOR[sectionIdx + 1] ?? semitone + 2
  const interpolatedSemitones = semitone + pos * (nextSemitone - semitone)
  return baseFreq * Math.pow(2, interpolatedSemitones / 12)
}

interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  string: number
  section: number
  startedAt: number
}

interface Props {
  lastMessage: WsEvent | null
}

export default function WebAudioPlayer({ lastMessage }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState('Désactivé')
  const [bankName, setBankName] = useState<string>('—')
  const [sampleFiles, setSampleFiles] = useState<string[]>([])

  const ctxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const filterRef = useRef<BiquadFilterNode | null>(null)
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  // string → Voice
  const voicesRef = useRef<Map<number, Voice>>(new Map())
  const volumeRef = useRef(0.8)
  const filterCutoffRef = useRef(8000)

  // Initialisation AudioContext
  const initAudio = useCallback(async () => {
    if (ctxRef.current) return

    const ctx = new AudioContext()
    const masterGain = ctx.createGain()
    masterGain.gain.value = volumeRef.current

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterCutoffRef.current

    masterGain.connect(filter)
    filter.connect(ctx.destination)

    ctxRef.current = ctx
    masterGainRef.current = masterGain
    filterRef.current = filter

    // Charger la liste des samples
    try {
      const resp = await getSamples()
      setBankName(resp.bank)
      setSampleFiles(resp.files)
      setStatus(`Chargement ${resp.files.length} samples…`)

      // Charger les buffers
      let loaded = 0
      await Promise.all(
        resp.files.map(async (f) => {
          try {
            const url = `${BASE_URL}/api/samples/${encodeURIComponent(f)}`
            const res = await fetch(url)
            if (!res.ok) return
            const arrayBuf = await res.arrayBuffer()
            const audioBuf = await ctx.decodeAudioData(arrayBuf)
            buffersRef.current.set(f, audioBuf)
            loaded++
          } catch {
            // Sample manquant ignoré
          }
        })
      )
      setStatus(`${loaded}/${resp.files.length} samples chargés ✓`)
    } catch {
      setStatus('Erreur chargement samples (backend hors-ligne ?)')
    }
  }, [])

  // Activer/désactiver
  const handleToggle = async () => {
    if (!enabled) {
      await initAudio()
      setEnabled(true)
    } else {
      ctxRef.current?.close().catch(() => undefined)
      ctxRef.current = null
      masterGainRef.current = null
      filterRef.current = null
      buffersRef.current.clear()
      voicesRef.current.clear()
      setEnabled(false)
      setStatus('Désactivé')
    }
  }

  // Trouver le meilleur sample pour (string, section)
  const findBuffer = (stringIdx: number, sectionIdx: number): AudioBuffer | null => {
    // Cherche d'abord string_section, puis string, puis premier dispo
    const keys = [...buffersRef.current.keys()]
    const exact = keys.find(k => k.includes(`_${stringIdx}_${sectionIdx}`) || k.includes(`s${stringIdx}n${sectionIdx}`))
    if (exact) return buffersRef.current.get(exact) ?? null
    const strMatch = keys.find(k => k.includes(`_${stringIdx}_`) || k.startsWith(`s${stringIdx}`))
    if (strMatch) return buffersRef.current.get(strMatch) ?? null
    if (keys[0]) return buffersRef.current.get(keys[0]) ?? null
    return null
  }

  // Jouer un note
  const playNote = useCallback((ev: OmniTouchEvent) => {
    const ctx = ctxRef.current
    const masterGain = masterGainRef.current
    if (!ctx || !masterGain || ev.state !== 'down') return

    const buf = findBuffer(ev.string, ev.section)
    if (!buf) return

    // Vol-stealing: couper la voix précédente sur cette corde
    const prevVoice = voicesRef.current.get(ev.string)
    if (prevVoice) {
      prevVoice.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03)
    }

    const targetFreq = sectionToFreq(ev.string, ev.section, ev.pos)
    // Fréquence de référence du sample (suppose E1=41.2 Hz si inconnu)
    const sampleFreq = STRING_BASE_FREQS[ev.string] ?? 55
    const playbackRate = targetFreq / sampleFreq

    const source = ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = playbackRate

    const gainNode = ctx.createGain()
    gainNode.gain.value = ev.pressure * volumeRef.current
    source.connect(gainNode)
    gainNode.connect(masterGain)
    source.start()

    voicesRef.current.set(ev.string, {
      source,
      gain: gainNode,
      string: ev.string,
      section: ev.section,
      startedAt: ctx.currentTime,
    })

    source.onended = () => {
      const v = voicesRef.current.get(ev.string)
      if (v && v.source === source) voicesRef.current.delete(ev.string)
    }
  }, [])

  // Arrêter une note
  const stopNote = useCallback((ev: OmniTouchEvent) => {
    const ctx = ctxRef.current
    const voice = voicesRef.current.get(ev.string)
    if (!ctx || !voice) return
    voice.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
    voice.source.stop(ctx.currentTime + 0.12)
    voicesRef.current.delete(ev.string)
  }, [])

  // Réagir aux événements WS
  useEffect(() => {
    if (!enabled || !lastMessage) return
    if (lastMessage.type === 'touch') {
      const ev = lastMessage as OmniTouchEvent
      if (ev.state === 'down') playNote(ev)
      else if (ev.state === 'up') stopNote(ev)
    } else if (lastMessage.type === 'pot') {
      if (lastMessage.id === 'volume' && masterGainRef.current) {
        volumeRef.current = lastMessage.value
        masterGainRef.current.gain.value = lastMessage.value
      } else if (lastMessage.id === 'filter' && filterRef.current) {
        const freq = 200 + lastMessage.value * 7800 // 200Hz–8kHz
        filterCutoffRef.current = freq
        filterRef.current.frequency.value = freq
      }
    }
  }, [lastMessage, enabled, playNote, stopNote])

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <button
          onClick={() => void handleToggle()}
          style={{
            padding: '4px 14px',
            background: enabled ? '#c62828' : '#1b5e20',
            border: 'none',
            color: '#fff',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 'bold',
          }}
        >
          {enabled ? '⏹ Stop' : '▶ Activer'}
        </button>
        <span style={{ fontSize: 11, color: '#888' }}>Banque: <strong style={{ color: '#ccc' }}>{bankName}</strong></span>
      </div>

      <div style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>{status}</div>

      {sampleFiles.length > 0 && (
        <div style={{ fontSize: 10, color: '#555', maxHeight: 80, overflowY: 'auto' }}>
          {sampleFiles.map(f => (
            <div key={f}>{f}</div>
          ))}
        </div>
      )}

      {!enabled && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
          ⚠ Cliquer Activer pour initialiser l'AudioContext (requis par le navigateur)
        </div>
      )}
    </div>
  )
}
