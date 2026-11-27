// ============================================================
// EventLog.tsx — Journal des événements WebSocket
// ============================================================

import { useEffect, useRef, useState } from 'react'
import type { WsEvent, TouchSource } from '../types'

const MAX_LINES = 200

type Filter = 'all' | TouchSource

interface LogEntry {
  id: number
  time: string
  source: string
  raw: string
}

interface Props {
  lastMessage: WsEvent | null
}

let _id = 0

function formatEntry(ev: WsEvent): LogEntry {
  const time = new Date().toISOString().slice(11, 23)
  let source = 'unknown'
  if ('source' in ev) source = ev.source

  let raw: string
  if (ev.type === 'touch') {
    raw = `[touch] ${ev.state} str=${ev.string} sec=${ev.section} pos=${ev.pos.toFixed(3)} pres=${ev.pressure.toFixed(2)}`
  } else if (ev.type === 'pot') {
    raw = `[pot] id=${ev.id} val=${ev.value.toFixed(3)}`
  } else {
    raw = JSON.stringify(ev)
  }

  return { id: _id++, time, source, raw }
}

export default function EventLog({ lastMessage }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  useEffect(() => {
    if (!lastMessage) return
    setEntries(prev => {
      const next = [...prev, formatEntry(lastMessage)]
      if (next.length > MAX_LINES) return next.slice(next.length - MAX_LINES)
      return next
    })
  }, [lastMessage])

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [entries])

  const filtered = filter === 'all'
    ? entries
    : entries.filter(e => e.source === filter)

  const colorFor = (source: string) => {
    if (source === 'hardware') return '#4caf50'
    if (source === 'simulator') return '#2196f3'
    return '#aaa'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Contrôles */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6, flexShrink: 0 }}>
        {(['all', 'hardware', 'simulator'] as const).map(f => (
          <label key={f} style={{ fontSize: 12, cursor: 'pointer', color: filter === f ? '#fff' : '#888' }}>
            <input
              type="radio"
              name="log-filter"
              value={f}
              checked={filter === f}
              onChange={() => setFilter(f)}
              style={{ marginRight: 4 }}
            />
            {f}
          </label>
        ))}
        <label style={{ fontSize: 12, cursor: 'pointer', color: '#aaa', marginLeft: 'auto' }}>
          <input
            type="checkbox"
            defaultChecked
            onChange={e => { autoScrollRef.current = e.target.checked }}
            style={{ marginRight: 4 }}
          />
          Auto-scroll
        </label>
        <button
          onClick={() => setEntries([])}
          style={{
            fontSize: 11, padding: '2px 8px', background: '#333',
            border: '1px solid #555', color: '#ccc', borderRadius: 4, cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      {/* Log */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: 11,
        background: '#111',
        borderRadius: 4,
        border: '1px solid #333',
        padding: '4px 6px',
      }}>
        {filtered.length === 0 && (
          <div style={{ color: '#555', padding: 8 }}>Aucun événement…</div>
        )}
        {filtered.map(e => (
          <div key={e.id} style={{ lineHeight: 1.6 }}>
            <span style={{ color: '#555' }}>{e.time} </span>
            <span style={{ color: colorFor(e.source), minWidth: 70, display: 'inline-block' }}>
              [{e.source}]
            </span>{' '}
            <span style={{ color: '#ddd' }}>{e.raw}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ fontSize: 10, color: '#555', marginTop: 4, textAlign: 'right' }}>
        {filtered.length} / {MAX_LINES} lignes
      </div>
    </div>
  )
}
