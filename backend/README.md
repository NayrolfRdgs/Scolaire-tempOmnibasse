# Omnibasse — Backend Python

Backend temps réel pour l'instrument tactile capacitif **Omnibasse** (4 cordes × 6 sections = 24 pads) sur Raspberry Pi.

## Architecture

```
backend/
├── main.py              # Point d'entrée FastAPI + uvicorn
├── config.py            # Modèles Pydantic (AppConfig, TouchEvent, PotEvent)
├── scales.py            # Moteur de gammes musicales
├── touch_engine.py      # Interpolation, hystérésis, arbitrage, modes Notes/Libre
├── audio_engine.py      # Lecture WAV RAM, polyphonie 4 voix, pitch-shift, filtre
├── ws_manager.py        # Gestionnaire WebSocket (broadcast)
├── hardware/
│   ├── __init__.py
│   ├── base.py          # Classe abstraite HardwareBackend
│   ├── mock.py          # MockHardware (développement PC)
│   └── mpr121.py        # MPR121HardwarePi + fabrique auto-détectée
├── requirements.txt
├── samples/             # Dossier des banques audio (créer manuellement)
│   └── bass-default/
│       ├── 0.wav        # Sample section 0
│       ├── 1.wav        # …
│       └── 5.wav
└── config.json          # Configuration persistée (créé au premier démarrage)
```

## Installation

```bash
# Créer l'environnement virtuel
python -m venv .venv

# Activer (Windows)
.venv\Scripts\activate
# Activer (Linux/Pi)
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Sur Raspberry Pi uniquement (driver I2C)
pip install smbus2
```

## Lancement

```bash
# Depuis le dossier backend/
python main.py
# ou
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

L'API est disponible sur `http://localhost:8000`.  
La documentation Swagger est sur `http://localhost:8000/docs`.

## Endpoints REST

| Méthode | URL               | Description                              |
|---------|-------------------|------------------------------------------|
| GET     | `/api/config`     | Configuration courante                   |
| PUT     | `/api/config`     | Mise à jour + application à chaud        |
| GET     | `/api/state`      | État runtime (mode, gamme, clients WS)   |
| GET     | `/api/calibration`| Valeurs brutes hardware instantanées     |
| GET     | `/api/samples`    | Liste des banques de samples             |
| POST    | `/api/samples`    | Changer de banque active `{"bank":"…"}`  |

## WebSocket

Connexion : `ws://localhost:8000/ws`

**Événements reçus (simulateur → backend) :**

```json
// TouchEvent
{
  "type": "touch",
  "state": "down",        // "down" | "move" | "up"
  "string": 0,            // 0-3
  "section": 2,           // 0-5
  "pos": 0.33,            // 0.0-1.0
  "pressure": 0.75,       // 0.0-1.0
  "source": "simulator",
  "t": 1700000000.0
}

// PotEvent
{
  "type": "pot",
  "id": "volume",         // "volume"|"filter"|"reverb"|"bank"|"key"
  "value": 0.8,           // 0.0-1.0
  "source": "simulator",
  "t": 1700000000.0
}
```

**Broadcast (backend → tous clients) :** mêmes formats JSON.

## Mapping hardware MPR121

| Canal global | Chip  | Canal chip | Corde | Section |
|:------------:|:-----:|:----------:|:-----:|:-------:|
| 0–5          | 0x5A  | 0–5        | 0     | 0–5     |
| 6–11         | 0x5A  | 6–11       | 1     | 0–5     |
| 12–17        | 0x5B  | 0–5        | 2     | 0–5     |
| 18–23        | 0x5B  | 6–11       | 3     | 0–5     |

## Gammes disponibles

`major`, `natural_minor`, `harmonic_minor`, `dorian`, `phrygian`,
`mixolydian`, `minor_pentatonic`, `minor_pentatonic_octave`, `chromatic`

## Préparer les samples

Les samples doivent être des fichiers WAV mono ou stéréo, 44100 Hz (ou tout taux — rééchantillonnage automatique).

```
samples/
└── bass-default/
    ├── 0.wav   ← section 0 (note grave)
    ├── 1.wav
    ├── 2.wav
    ├── 3.wav
    ├── 4.wav
    └── 5.wav   ← section 5 (note aiguë)
```

## Dégradations gracieuses

| Situation                   | Comportement                              |
|-----------------------------|-------------------------------------------|
| `sounddevice` absent        | Pas d'audio, reste fonctionnel            |
| `scipy` absent              | Pas de pitch-shift ni filtre IIR          |
| smbus2 / `/dev/i2c-1` absent | MockHardware automatique (mode PC)        |
| Banque de samples manquante | Silence (pas de crash)                   |
| Sample section manquant     | Section silencieuse (les autres jouent)  |
