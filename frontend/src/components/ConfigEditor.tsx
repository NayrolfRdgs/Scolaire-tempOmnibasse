// ============================================================
// ConfigEditor.tsx — Éditeur JSON de la configuration
// ============================================================

import { useCallback, useEffect, useState } from 'react'
import { getConfig, putConfig } from '../api'
import type { AppConfig } from '../types'

export default function ConfigEditor() {
  const [text, setText] = useState<string>('')
  const [status, setStatus] = useState<string>('Chargement…')
  const [statusColor, setStatusColor] = useState<string>('#888')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setStatus('Chargement…')
    setStatusColor('#888')
    try {
      const cfg = await getConfig()
      setText(JSON.stringify(cfg, null, 2))
      setStatus('Chargé ✓')
      setStatusColor('#4caf50')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus(`Erreur: ${msg}`)
      setStatusColor('#f44336')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const apply = async () => {
    setLoading(true)
    setStatus('Envoi…')
    setStatusColor('#888')
    try {
      let parsed: AppConfig
      try {
        parsed = JSON.parse(text) as AppConfig
      } catch {
        setStatus('JSON invalide')
        setStatusColor('#f44336')
        setLoading(false)
        return
      }
      const result = await putConfig(parsed)
      setText(JSON.stringify(result, null, 2))
      setStatus('Appliqué ✓')
      setStatusColor('#4caf50')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Essayer d'extraire l'erreur Pydantic
      let detail = msg
      try {
        const match = msg.match(/HTTP \d+: (.+)/)
        if (match) {
          const body = JSON.parse(match[1]) as { detail: unknown }
          detail = JSON.stringify(body.detail, null, 2)
        }
      } catch { /* ignore */ }
      setStatus(`Erreur:\n${detail}`)
      setStatusColor('#f44336')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => void load()}
          disabled={loading}
          style={{
            fontSize: 12, padding: '3px 10px', background: '#333',
            border: '1px solid #555', color: '#ccc', borderRadius: 4, cursor: 'pointer',
          }}
        >
          Recharger
        </button>
        <button
          onClick={() => void apply()}
          disabled={loading}
          style={{
            fontSize: 12, padding: '3px 10px', background: '#1565c0',
            border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer',
          }}
        >
          Appliquer
        </button>
        <span style={{ fontSize: 11, color: statusColor, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {status}
        </span>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          fontFamily: 'monospace',
          fontSize: 12,
          background: '#111',
          color: '#d4d4d4',
          border: '1px solid #333',
          borderRadius: 4,
          padding: 8,
          resize: 'none',
          outline: 'none',
        }}
      />
    </div>
  )
}
