// ============================================================
// TouchGrid.tsx — Grille tactile avec glissement continu fluide inter-frettes
// ============================================================

import { useEffect, useRef, useState } from 'react'
import type { TouchEvent as OmniTouchEvent, WsEvent } from '../types'
import { browserSynth } from '../audioSynthesizer'

const SECTIONS = 6

const STRING_INFO = [
  { id: 0, note: 'G2', label: 'Corde 1 (G2)' },
  { id: 1, note: 'D2', label: 'Corde 2 (D2)' },
  { id: 2, note: 'A1', label: 'Corde 3 (A1)' },
  { id: 3, note: 'E1', label: 'Corde 4 (E1)' },
]

const KEY_MAP: Record<string, { string: number; section: number }> = {
  'w': { string: 3, section: 0 },
  'x': { string: 3, section: 1 },
  'c': { string: 3, section: 2 },
  'v': { string: 3, section: 3 },
  'b': { string: 3, section: 4 },
  'n': { string: 3, section: 5 },

  's': { string: 2, section: 0 },
  'd': { string: 2, section: 1 },
  'f': { string: 2, section: 2 },
  'g': { string: 2, section: 3 },
  'h': { string: 2, section: 4 },
  'j': { string: 2, section: 5 },

  'e': { string: 1, section: 0 },
  'r': { string: 1, section: 1 },
  't': { string: 1, section: 2 },
  'y': { string: 1, section: 3 },
  'u': { string: 1, section: 4 },
  'i': { string: 1, section: 5 },

  '3': { string: 0, section: 0 },
  '4': { string: 0, section: 1 },
  '5': { string: 0, section: 2 },
  '6': { string: 0, section: 3 },
  '7': { string: 0, section: 4 },
  '8': { string: 0, section: 5 },
}

interface Props {
  sendEvent: (e: WsEvent) => void
  lastMessage: WsEvent | null
}

export default function TouchGrid({ sendEvent, lastMessage }: Props) {
  const [activePad, setActivePad] = useState<{ string: number; section: number } | null>(null)
  const isPointerDownRef = useRef(false)
  const currentCoordRef = useRef<{ string: number; section: number } | null>(null)

  // Événements reçus depuis le WebSocket (Hardware Pi)
  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'touch') return
    const ev = lastMessage as OmniTouchEvent
    if (ev.state === 'down' || ev.state === 'move') {
      setActivePad({ string: ev.string, section: ev.section })
      browserSynth.noteSlide(ev.string, ev.section + (ev.pos ?? 0.5))
    } else {
      setActivePad(null)
      browserSynth.noteOff(ev.string)
    }
  }, [lastMessage])

  // Détection robuste des coordonnées même lors du glissement dans les marges ou entre touches
  const getCellFromPoint = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY)
    let pad = el?.closest('[data-pad]') as HTMLElement | null

    // Si on survole l'espace entre deux touches, chercher la ligne de corde la plus proche
    if (!pad) {
      const row = el?.closest('[data-string-row]') as HTMLElement | null
      if (row) {
        const pads = Array.from(row.querySelectorAll('[data-pad]')) as HTMLElement[]
        for (const p of pads) {
          const r = p.getBoundingClientRect()
          if (clientX >= r.left && clientX <= r.right) {
            pad = p
            break
          }
        }
      }
    }

    if (!pad) return null

    const stringIdx = parseInt(pad.dataset.string ?? '-1', 10)
    const sectionIdx = parseInt(pad.dataset.section ?? '-1', 10)
    if (stringIdx < 0 || sectionIdx < 0) return null

    const rect = pad.getBoundingClientRect()
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))

    return { stringIdx, sectionIdx, pos, fractionalSection: sectionIdx + pos }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDownRef.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

    const cell = getCellFromPoint(e.clientX, e.clientY)
    if (!cell) return

    currentCoordRef.current = { string: cell.stringIdx, section: cell.sectionIdx }
    setActivePad({ string: cell.stringIdx, section: cell.sectionIdx })

    browserSynth.noteOn(cell.stringIdx, cell.fractionalSection)

    sendEvent({
      type: 'touch',
      state: 'down',
      string: cell.stringIdx,
      section: cell.sectionIdx,
      pos: cell.pos,
      pressure: 1.0,
      source: 'simulator',
      t: Date.now() / 1000,
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDownRef.current) return

    const cell = getCellFromPoint(e.clientX, e.clientY)
    if (!cell) return

    const prev = currentCoordRef.current

    // Changement de frette (gauche/droite) ou de corde (haut/bas) en glissant
    if (!prev || prev.string !== cell.stringIdx || prev.section !== cell.sectionIdx) {
      if (prev && prev.string !== cell.stringIdx) {
        browserSynth.noteOff(prev.string)
      }
      // noteSlide s'occupe de déclencher la nouvelle frette immédiatement (Omnichord slide)
      browserSynth.noteSlide(cell.stringIdx, cell.fractionalSection)
      currentCoordRef.current = { string: cell.stringIdx, section: cell.sectionIdx }
      setActivePad({ string: cell.stringIdx, section: cell.sectionIdx })

      sendEvent({
        type: 'touch',
        state: 'down',
        string: cell.stringIdx,
        section: cell.sectionIdx,
        pos: cell.pos,
        pressure: 1.0,
        source: 'simulator',
        t: Date.now() / 1000,
      })
    } else {
      // Glissement continu à l'intérieur de la même touche
      browserSynth.noteSlide(cell.stringIdx, cell.fractionalSection)

      sendEvent({
        type: 'touch',
        state: 'move',
        string: cell.stringIdx,
        section: cell.sectionIdx,
        pos: cell.pos,
        pressure: 1.0,
        source: 'simulator',
        t: Date.now() / 1000,
      })
    }
  }

  const handlePointerUp = () => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false

    if (currentCoordRef.current) {
      browserSynth.noteOff(currentCoordRef.current.string)
      sendEvent({
        type: 'touch',
        state: 'up',
        string: currentCoordRef.current.string,
        section: currentCoordRef.current.section,
        pos: 0.5,
        pressure: 0.0,
        source: 'simulator',
        t: Date.now() / 1000,
      })
      currentCoordRef.current = null
    }

    setActivePad(null)
  }

  // Clavier
  useEffect(() => {
    const pressed = new Set<string>()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      const k = e.key.toLowerCase()
      const mapping = KEY_MAP[k]
      if (mapping && !pressed.has(k)) {
        pressed.add(k)
        setActivePad({ string: mapping.string, section: mapping.section })
        browserSynth.noteOn(mapping.string, mapping.section + 0.5)
        sendEvent({
          type: 'touch',
          state: 'down',
          string: mapping.string,
          section: mapping.section,
          pos: 0.5,
          pressure: 1.0,
          source: 'simulator',
          t: Date.now() / 1000,
        })
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const mapping = KEY_MAP[k]
      if (mapping) {
        pressed.delete(k)
        setActivePad(null)
        browserSynth.noteOff(mapping.string)
        sendEvent({
          type: 'touch',
          state: 'up',
          string: mapping.string,
          section: mapping.section,
          pos: 0.5,
          pressure: 0.0,
          source: 'simulator',
          t: Date.now() / 1000,
        })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [sendEvent])

  return (
    <div style={{
      userSelect: 'none',
      width: '100%',
      maxWidth: 1000,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>

      {/* Surface tactile globale avec glissement continu */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          touchAction: 'none',
          cursor: 'grab',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: 24,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Colonnes des Frettes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px repeat(6, 1fr)',
          gap: 12,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center' }}>
            Cordes
          </div>
          {Array.from({ length: SECTIONS }, (_, i) => (
            <div
              key={i}
              style={{
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#64748b',
                padding: '4px 0',
              }}
            >
              Frette {i + 1}
            </div>
          ))}
        </div>

        {/* Lignes de Cordes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STRING_INFO.map(s => (
            <div
              key={s.id}
              data-string-row="true"
              style={{
                display: 'grid',
                gridTemplateColumns: '120px repeat(6, 1fr)',
                gap: 12,
                alignItems: 'center',
              }}
            >
              {/* Badge d'en-tête de corde */}
              <div style={{
                height: 64,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '0 12px',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{s.note}</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{s.label}</span>
              </div>

              {/* 6 Pavés tactiles pour cette corde */}
              {Array.from({ length: SECTIONS }, (_, sectionIdx) => {
                const isActive = activePad?.string === s.id && activePad?.section === sectionIdx

                return (
                  <div
                    key={sectionIdx}
                    data-pad="true"
                    data-string={s.id}
                    data-section={sectionIdx}
                    style={{
                      height: 64,
                      backgroundColor: isActive ? '#2563eb' : '#f8fafc',
                      border: isActive ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                      borderRadius: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.05s ease, transform 0.05s ease, box-shadow 0.05s ease',
                      transform: isActive ? 'scale(0.96)' : 'scale(1)',
                      boxShadow: isActive
                        ? '0 0 20px rgba(37, 99, 235, 0.45)'
                        : '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <span style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isActive ? '#ffffff' : '#334155',
                      pointerEvents: 'none',
                    }}>
                      §{sectionIdx + 1}
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: isActive ? '#93c5fd' : '#94a3b8',
                      fontWeight: 600,
                      marginTop: 2,
                      pointerEvents: 'none',
                    }}>
                      {s.note}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Raccourcis clavier */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 20px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        fontSize: 12,
        color: '#64748b',
      }}>
        <span style={{ fontWeight: 600, color: '#334155' }}>⌨️ Raccourcis clavier :</span>
        <span><strong>G2 :</strong> 3, 4, 5, 6, 7, 8</span>
        <span><strong>D2 :</strong> E, R, T, Y, U, I</span>
        <span><strong>A1 :</strong> S, D, F, G, H, J</span>
        <span><strong>E1 :</strong> W, X, C, V, B, N</span>
      </div>

    </div>
  )
}
