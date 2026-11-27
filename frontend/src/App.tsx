// ============================================================
// App.tsx — Omnibasse UI claire, moderne et intuitive
// ============================================================

import { useState } from 'react'
import { useWebSocket } from './api'
import TouchGrid from './components/TouchGrid'
import PotSliders from './components/PotSliders'
import CalibMonitor from './components/CalibMonitor'
import EventLog from './components/EventLog'
import ConfigEditor from './components/ConfigEditor'

type Tab = 'grid' | 'calib' | 'log' | 'config'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'grid',   label: 'Surface de Jeu', icon: '🎸' },
  { id: 'calib',  label: 'Capteurs MPR121', icon: '📊' },
  { id: 'config', label: 'Configuration', icon: '⚙️' },
  { id: 'log',    label: 'Journal Direct', icon: '📋' },
]

export default function App() {
  const { connected, lastMessage, sendEvent } = useWebSocket('/ws')
  const [activeTab, setActiveTab] = useState<Tab>('grid')

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Barre de navigation supérieure claire */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 16,
          }}>
            Ω
          </div>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Omnibasse Studio
            </h1>
            <p style={{ fontSize: 11, margin: 0, color: '#64748b' }}>
              Simulateur & Contrôleur Tactile Quantifié
            </p>
          </div>
        </div>

        {/* Statut Réseau / Hardware */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: connected ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${connected ? '#a7f3d0' : '#fecaca'}`,
          padding: '6px 14px',
          borderRadius: 20,
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: connected ? '#10b981' : '#ef4444',
          }} />
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: connected ? '#065f46' : '#991b1b',
          }}>
            {connected ? 'Serveur Pi Connecté' : 'Mode Navigateur Autonome'}
          </span>
        </div>
      </header>

      {/* Contenu principal */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Panneau latéral gauche : Potentiomètres */}
        <aside style={{
          width: 250,
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          padding: '20px 16px',
          overflowY: 'auto',
          flexShrink: 0,
        }}>
          <h2 style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#64748b',
            marginBottom: 16,
          }}>
            Réglages & Potentiomètres
          </h2>
          <PotSliders sendEvent={sendEvent} />
        </aside>

        {/* Espace central de jeu et d'onglets */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Onglets clairs */}
          <nav style={{
            display: 'flex',
            gap: 6,
            padding: '12px 24px 0 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}>
            {TABS.map(tab => {
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    border: 'none',
                    borderBottom: isSelected ? '2px solid #2563eb' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: isSelected ? '#2563eb' : '#64748b',
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Corps de l'onglet sélectionné */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {activeTab === 'grid' && (
              <TouchGrid sendEvent={sendEvent} lastMessage={lastMessage} />
            )}

            {activeTab === 'calib' && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <CalibMonitor />
              </div>
            )}

            {activeTab === 'config' && (
              <div style={{ maxWidth: 900, margin: '0 auto', height: '100%' }}>
                <ConfigEditor />
              </div>
            )}

            {activeTab === 'log' && (
              <div style={{ maxWidth: 900, margin: '0 auto', height: '100%' }}>
                <EventLog lastMessage={lastMessage} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
