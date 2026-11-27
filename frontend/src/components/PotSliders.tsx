// ============================================================
// PotSliders.tsx — Contrôles, Sélecteurs, Volume Booster jusqu'à 200% & Reset
// ============================================================

import { useState } from 'react'
import type { WsEvent } from '../types'
import { browserSynth, SOUND_BANKS, KEYS } from '../audioSynthesizer'

interface Props {
  sendEvent: (e: WsEvent) => void
}

export default function PotSliders({ sendEvent }: Props) {
  // Volume par défaut à 0.6 (60%) et montant jusqu'à 2.0 (200%)
  const [volume, setVolume] = useState(0.6)
  const [filter, setFilter] = useState(0.85)
  const [reverb, setReverb] = useState(0.2)
  const [selectedBank, setSelectedBank] = useState('rhodes-mark1')
  const [selectedKey, setSelectedKey] = useState(0)

  const handleVolumeChange = (val: number) => {
    setVolume(val)
    browserSynth.setVolume(val)
    sendEvent({ type: 'pot', id: 'volume', value: Math.min(1.0, val / 2.0), source: 'simulator', t: Date.now() / 1000 })
  }

  const handleFilterChange = (val: number) => {
    setFilter(val)
    browserSynth.setFilter(val)
    sendEvent({ type: 'pot', id: 'filter', value: val, source: 'simulator', t: Date.now() / 1000 })
  }

  const handleReverbChange = (val: number) => {
    setReverb(val)
    sendEvent({ type: 'pot', id: 'reverb', value: val, source: 'simulator', t: Date.now() / 1000 })
  }

  const handleBankChange = (bankId: string) => {
    setSelectedBank(bankId)
    browserSynth.setBank(bankId)
    const bankIdx = SOUND_BANKS.findIndex(b => b.id === bankId)
    const normalizedVal = bankIdx >= 0 ? bankIdx / (SOUND_BANKS.length - 1) : 0
    sendEvent({ type: 'pot', id: 'bank', value: normalizedVal, source: 'simulator', t: Date.now() / 1000 })
  }

  const handleKeyChange = (semitones: number) => {
    setSelectedKey(semitones)
    browserSynth.setKey(semitones)
    const normalizedVal = semitones / 11
    sendEvent({ type: 'pot', id: 'key', value: normalizedVal, source: 'simulator', t: Date.now() / 1000 })
  }

  const handleReset = () => {
    setVolume(0.6)
    setFilter(0.85)
    setReverb(0.2)
    setSelectedBank('rhodes-mark1')
    setSelectedKey(0)
    browserSynth.resetAllSettings()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* 1. Sélecteur de Banque avec Fender Rhodes */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '12px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>📦 Instrument / Banque</span>
          <span style={{ fontSize: 10, backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>4s WAV</span>
        </div>
        <select
          value={selectedBank}
          onChange={e => handleBankChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#1e293b',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {SOUND_BANKS.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.desc}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Sélecteur de Tonalité (Menu Déroulant) */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '12px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>🎵 Tonalité</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ec4899' }}>
            {KEYS.find(k => k.semitones === selectedKey)?.label}
          </span>
        </div>
        <select
          value={selectedKey}
          onChange={e => handleKeyChange(parseInt(e.target.value, 10))}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: '#1e293b',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {KEYS.map(k => (
            <option key={k.semitones} value={k.semitones}>
              {k.label} {k.semitones === 0 ? '(Standard)' : `(+${k.semitones} demi-tons)`}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Slider Volume avec Booster jusqu'à 200% */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
            Volume {volume > 1.0 && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚡ Boost</span>}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: volume > 1.0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
            {Math.round(volume * 100)}%
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>Plage étendue de 0% à 200%</div>
        <input
          type="range"
          min={0}
          max={2.0}
          step={0.02}
          value={volume}
          onChange={e => handleVolumeChange(parseFloat(e.target.value))}
          style={{
            width: '100%',
            accentColor: volume > 1.0 ? '#ef4444' : '#10b981',
            cursor: 'pointer',
          }}
        />
      </div>

      {/* 4. Slider Filtre */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>Filtre Passe-Bas</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
            {Math.round(filter * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={filter}
          onChange={e => handleFilterChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#3b82f6', cursor: 'pointer' }}
        />
      </div>

      {/* 5. Slider Reverb */}
      <div style={{
        backgroundColor: '#ffffff',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid #e2e8f0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>Ambiance / Espace</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8b5cf6', fontFamily: 'monospace' }}>
            {Math.round(reverb * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={reverb}
          onChange={e => handleReverbChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#8b5cf6', cursor: 'pointer' }}
        />
      </div>

      {/* 6. Bouton Reset */}
      <button
        onClick={handleReset}
        style={{
          marginTop: 4,
          padding: '10px 14px',
          backgroundColor: '#f1f5f9',
          color: '#475569',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
        }}
      >
        <span>🔄</span>
        <span>Réinitialiser les Réglages</span>
      </button>

    </div>
  )
}
