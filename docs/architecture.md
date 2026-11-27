# Architecture

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────┐
│                  Raspberry Pi (prod)                     │
│                                                          │
│  ┌──────────────┐    I2C     ┌───────────────────────┐  │
│  │  MPR121 × 2  │◄──────────│   backend Python       │  │
│  │  (24 pads)   │           │   FastAPI + uvicorn    │  │
│  └──────────────┘           │   :8000                │  │
│                              └──────────┬────────────┘  │
│  ┌──────────────┐    I2C/SPI            │               │
│  │ MCP3008 ou   │◄──────────────────────┘               │
│  │ ADS1115 × 1  │  (5 potentiomètres)                   │
│  └──────────────┘                                        │
└─────────────────────────────────┬───────────────────────┘
                                  │ HTTP / WebSocket
                    ┌─────────────▼──────────────┐
                    │  Navigateur / Frontend     │
                    │  React + Vite (test/dev)   │
                    │  :5173                     │
                    └────────────────────────────┘
```

En développement Windows, le hardware est remplacé automatiquement par `MockHardware`. La page web envoie des événements WebSocket `source: "simulator"` qui suivent exactement le même chemin que les événements matériels.

## Couches

| Couche | Rôle | Choix |
| --- | --- | --- |
| Entrées | Lire MPR121 et ADC, ou recevoir les gestes du navigateur | `HardwareBackend` : `MockHardware` / `MPR121HardwarePi` |
| Cœur | Quantification, hystérésis, interpolation, mapping | `config.py`, `scales.py`, `touch_engine.py` |
| Audio | Charger les WAV en RAM, jouer, transposer, filtrer | `audio_engine.py` (`sounddevice` + NumPy/SciPy) |
| API | REST pour la configuration, WebSocket pour le direct | `main.py`, `ws_manager.py` |
| Interface de test | Surface simulée, sliders, calibration, journal | React + Vite + TypeScript |

## Règles d'architecture

1. Le cœur ne connaît pas le matériel : il ne consomme que des événements normalisés.
2. Le même back tourne sur le PC et sur le Raspberry Pi ; la source d'entrée doit pouvoir être choisie par `OMNIBASSE_INPUT` (voir [manquant_logiciel.md](manquant_logiciel.md#m-13--variable-omnibasse_input)).
3. La configuration est un JSON versionné (`schema_version`), validé par Pydantic et appliqué à chaud.

## Structure du dépôt

```text
Scolaire-tempOmnibasse/
├── README.md                  ← accueil et liens
├── docs/                      ← toute la documentation
├── simulations/               ← scripts Python de simulation / relevé
├── backend/
│   ├── main.py                ← API FastAPI + boucle hardware
│   ├── config.py              ← modèles Pydantic
│   ├── scales.py              ← gammes et conversions note ↔ Hz
│   ├── touch_engine.py        ← détection, barycentre, arbitrage
│   ├── audio_engine.py        ← sampler et filtres audio
│   ├── ws_manager.py          ← diffusion WebSocket
│   ├── hardware/              ← base.py, mock.py, mpr121.py
│   ├── samples/               ← banques WAV du back
│   └── requirements.txt
└── frontend/
    ├── src/App.tsx            ← onglets de l'interface
    ├── src/api.ts             ← appels REST / WebSocket
    ├── src/components/        ← grille, sliders, calib, log, config
    └── public/samples/        ← banques WAV du navigateur
```

Les justifications des bibliothèques sont dans [decisions.md](decisions.md).
