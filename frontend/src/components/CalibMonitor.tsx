// ============================================================
// CalibMonitor.tsx — Affichage des 24 valeurs brutes MPR121
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { getCalibration } from '../api'
import type { CalibrationData } from '../types'

const STRINGS = 4
const SECTIONS = 6
const POLL_MS = 100

const STRING_LABELS = ['G2', 'D2', 'A1', 'E1']

export default function CalibMonitor() {
  const [data, setData] = useState<CalibrationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const poll = async () => {
      try {
        const d = await getCalibration()
        setData(d)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    }

    void poll()
    intervalRef.current = setInterval(poll, POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active])

  // Canal 0-23 → (string, section)
  // string 0-1: chip A, string 2-3: chip B
  // string 0: canaux 0-5, string 1: canaux 6-11
  // string 2: canaux 0-5 chip B → offset 12, string 3: canaux 6-11 chip B → offset 18
  const getChannel = (s: number, sec: number): number => {
    if (s < 2) return s * 6 + sec
    return 12 + (s - 2) * 6 + sec
  }

  const getMax = (ch: number): number => {
    if (!data) return 1
    return data.max_values?.[ch] || 100
  }

  const getValue = (ch: number): number => {
    if (!data) return 0
    return data.values?.[ch] ?? 0
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={active}
            onChange={e => setActive(e.target.checked)}
            style={{ marginRight: 4 }}
          />
          Polling actif
        </label>
        {error && <span style={{ color: '#f44336', fontSize: 11 }}>{error}</span>}
        {!error && data && <span style={{ color: '#4caf50', fontSize: 11 }}>OK</span>}
      </div>

      {/* En-tête sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(6, 1fr)', marginBottom: 2 }}>
        <div />
        {Array.from({ length: SECTIONS }, (_, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#666' }}>§{i}</div>
        ))}
      </div>

      {Array.from({ length: STRINGS }, (_, s) => (
        <div key={s} style={{ display: 'grid', gridTemplateColumns: '36px repeat(6, 1fr)', marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: '#ccc', display: 'flex', alignItems: 'center' }}>
            {STRING_LABELS[s]}
          </div>
          {Array.from({ length: SECTIONS }, (_, sec) => {
            const ch = getChannel(s, sec)
            const val = getValue(ch)
            const max = getMax(ch)
            const pct = Math.min(100, (val / max) * 100)
            const hue = pct > 70 ? 120 : pct > 40 ? 60 : 0 // vert/jaune/rouge
            return (
              <div key={sec} style={{ padding: '0 2px' }}>
                <div style={{
                  height: 32,
                  background: '#1a1a1a',
                  borderRadius: 3,
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid #333',
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: `${pct}%`,
                    background: `hsl(${hue}, 70%, 45%)`,
                    transition: 'height 0.08s, background 0.08s',
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontFamily: 'monospace',
                    color: pct > 50 ? '#000' : '#888',
                  }}>
                    {val}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
