// ============================================================
// api.ts — Fonctions REST + hook WebSocket
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react'
import type { AppConfig, AppState, CalibrationData, SamplesResponse, WsEvent } from './types'

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'
const WS_URL = BASE_URL.replace(/^http/, 'ws')

// ---- REST helpers ----

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export function getConfig(): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/config')
}

export function putConfig(config: AppConfig): Promise<AppConfig> {
  return apiFetch<AppConfig>('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export function getState(): Promise<AppState> {
  return apiFetch<AppState>('/api/state')
}

export function getCalibration(): Promise<CalibrationData> {
  return apiFetch<CalibrationData>('/api/calibration')
}

export function getSamples(): Promise<SamplesResponse> {
  return apiFetch<SamplesResponse>('/api/samples')
}

// ---- WebSocket hook ----

export interface UseWebSocketResult {
  connected: boolean
  lastMessage: WsEvent | null
  sendEvent: (event: WsEvent) => void
}

export function useWebSocket(path = '/ws'): UseWebSocketResult {
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WsEvent | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const queueRef = useRef<WsEvent[]>([])

  const sendEvent = useCallback((event: WsEvent) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event))
    } else {
      // Mise en file d'attente si pas encore connecté
      queueRef.current.push(event)
    }
  }, [])

  useEffect(() => {
    // Résolution dynamique de l'URL WS (proxy Vite ou direct)
    const url = window.location.protocol === 'file:'
      ? `${WS_URL}${path}`
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${path}`

    let ws: WebSocket
    let reconnectTimeout: ReturnType<typeof setTimeout>

    const connect = () => {
      ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setConnected(true)
        // Vider la file d'attente
        for (const evt of queueRef.current) {
          ws.send(JSON.stringify(evt))
        }
        queueRef.current = []
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as WsEvent
          setLastMessage(data)
        } catch {
          // Message non-JSON ignoré
        }
      }

      ws.onclose = () => {
        setConnected(false)
        // Reconnexion automatique après 2s
        reconnectTimeout = setTimeout(connect, 2000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectTimeout)
      wsRef.current?.close()
    }
  }, [path])

  return { connected, lastMessage, sendEvent }
}
