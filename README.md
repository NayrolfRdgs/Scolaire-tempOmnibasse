# 🎸 Omnibasse

> **Projet scolaire** — Lycée, Olympiades de sciences de l'ingénieur 2027 (thème « L'ingénierie au service de l'art »). Dépôt privé, usage pédagogique interne.

Instrument tactile capacitif à 4 cordes × 6 sections — backend Python + frontend React de test + hardware Raspberry Pi.

---

## Présentation

L'**Omnibasse** est un instrument de musique électronique pédagogique constitué d'une surface tactile capacitive émulant une basse à 4 cordes. Chaque corde est divisée en 6 sections (cases), permettant :

- **Mode Notes** : chaque section déclenche une note de la gamme configurée
- **Mode Libre** : la position continue sur la section produit un pitch-bend en temps réel

Le tout est piloté par un **Raspberry Pi** (backend Python/FastAPI) et peut être testé depuis un navigateur web (frontend React).

## Documentation

Le dossier [`docs/`](docs/README.md) contient le cahier des charges, le guide des simulations, les protocoles de mesure, les choix techniques et le suivi détaillé de ce qui reste à créer côté logiciel.

---

## Architecture

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

**Développement Windows** : le hardware est remplacé par un `MockHardware` automatiquement. Le frontend permet de simuler les touches.

---

## Structure du projet

```
OM/
├── README.md                   ← Ce fichier
├── .gitignore
├── start_dev.bat               ← Lancer le backend (Windows)
├── start_frontend.bat          ← Lancer le frontend (Windows)
│
├── backend/
│   ├── main.py                 ← Point d'entrée FastAPI
│   ├── config.py               ← Modèles Pydantic (AppConfig, TouchEvent…)
│   ├── scales.py               ← Moteur de gammes musicales
│   ├── touch_engine.py         ← Interpolation, hystérésis, arbitrage
│   ├── audio_engine.py         ← Lecture WAV, polyphonie, pitch-shift
│   ├── ws_manager.py           ← Gestionnaire WebSocket
│   ├── requirements.txt
│   ├── .env.example            ← Variables d'environnement
│   ├── install_pi.sh           ← Script d'installation Raspberry Pi
│   ├── omnibasse.service       ← Service systemd
│   └── samples/
│       └── bass-default/       ← Samples WAV par défaut (non versionnés)
│           └── .gitkeep
│
├── backend/hardware/
│   ├── __init__.py
│   ├── base.py                 ← Classe abstraite HardwareBackend
│   ├── mock.py                 ← MockHardware (dev Windows/PC)
│   └── mpr121.py               ← MPR121HardwarePi (Raspberry Pi)
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        ├── components/
        │   ├── TouchGrid.tsx
        │   ├── PotSliders.tsx
        │   ├── CalibMonitor.tsx
        │   ├── EventLog.tsx
        │   ├── ConfigEditor.tsx
        │   └── WebAudioPlayer.tsx
        └── types.ts
```

---

## Installation et lancement

### Développement Windows

#### Prérequis

- Python 3.10+ avec pip
- Node.js 18+ avec npm

#### Backend

```bat
cd G:\.Pro\.Dev\Lycee\OM\backend

:: Créer l'environnement virtuel
python -m venv .venv
.venv\Scripts\activate

:: Installer les dépendances
pip install -r requirements.txt

:: Copier et adapter la config
copy .env.example .env

:: Lancer (ou utiliser start_dev.bat)
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

#### Frontend

```bat
cd G:\.Pro\.Dev\Lycee\OM\frontend
npm install
npm run dev
```

Ouvrir [http://localhost:5173](http://localhost:5173)

---

### Production Raspberry Pi

#### Installation automatique

```bash
# Cloner le dépôt sur le Pi
git clone <repo-url> /home/pi/omnibasse
cd /home/pi/omnibasse/backend

# Lancer le script d'installation
chmod +x install_pi.sh
sudo ./install_pi.sh
```

Le script :
1. Installe les dépendances système (`i2c-tools`, `python3-venv`…)
2. Active le bus I2C
3. Crée le virtualenv et installe les packages Python
4. Installe et active le service systemd `omnibasse`

#### Vérification du service

```bash
sudo systemctl status omnibasse
sudo journalctl -u omnibasse -f
```

---

## Contrat API

### REST

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/config` | Lire la configuration complète (`AppConfig`) |
| `PUT` | `/api/config` | Mettre à jour la configuration (validation Pydantic + application à chaud) |
| `GET` | `/api/state` | État courant du moteur (notes actives, valeurs pots) |
| `GET` | `/api/calibration` | 24 valeurs brutes MPR121 (delta capacitif, 0-1023) |
| `GET` | `/api/samples` | Liste des banques de samples disponibles |
| `POST` | `/api/samples` | Uploader une nouvelle banque de samples |

### WebSocket `/ws`

Connexion persistante bidirectionnelle.

#### Événements entrants (simulateur → backend)

```json
{
  "type": "touch",
  "state": "down",
  "string": 0,
  "section": 2,
  "pos": 0.5,
  "pressure": 1.0,
  "source": "simulator",
  "t": 1700000000.123
}
```

```json
{
  "type": "pot",
  "id": "volume",
  "value": 0.75,
  "source": "simulator",
  "t": 1700000000.456
}
```

#### Événements sortants (backend → tous les clients)

Mêmes formats `TouchEvent` et `PotEvent`, avec `source: "hardware"` ou `"simulator"`.

---

## Configuration (`AppConfig`)

Fichier JSON retourné par `GET /api/config` et modifiable via `PUT /api/config`.

```json
{
  "schema_version": 1,
  "layout": {
    "strings": 4,
    "sections": 6
  },
  "strings": [
    { "id": 0, "base_note": "E1" },
    { "id": 1, "base_note": "A1" },
    { "id": 2, "base_note": "D2" },
    { "id": 3, "base_note": "G2" }
  ],
  "scale": {
    "root": "E",
    "mode": "minor_pentatonic_octave"
  },
  "play_mode": "notes",
  "touch": {
    "threshold": 12,
    "release": 6,
    "hysteresis": 0.05
  },
  "pots": [
    { "id": "volume",  "channel": 0 },
    { "id": "filter",  "channel": 1 },
    { "id": "reverb",  "channel": 2 },
    { "id": "bank",    "channel": 3 },
    { "id": "key",     "channel": 4 }
  ],
  "samples": {
    "bank": "bass-default"
  }
}
```

### Gammes disponibles (`scale.mode`)

| Clé | Description |
|-----|-------------|
| `major` | Gamme majeure |
| `natural_minor` | Gamme mineure naturelle |
| `harmonic_minor` | Gamme mineure harmonique |
| `dorian` | Mode dorien |
| `minor_pentatonic` | Pentatonique mineure (5 notes) |
| `minor_pentatonic_octave` | Pentatonique mineure + octave (défaut) |
| `chromatic` | Chromatique (12 demi-tons) |
| `phrygian` | Mode phrygien |
| `mixolydian` | Mode mixolydien |

---

## Schémas de câblage

### MPR121 × 2 via I2C

```
Raspberry Pi          MPR121 (chip A, addr 0x5A)
─────────────         ──────────────────────────
3.3V  (pin 1)  ──────► VCC
GND   (pin 6)  ──────► GND
SDA   (pin 3)  ──────► SDA
SCL   (pin 5)  ──────► SCL
                       ADDR ── GND (→ 0x5A)

                       MPR121 (chip B, addr 0x5B)
                       ──────────────────────────
                       VCC ◄── 3.3V (pin 1)
                       GND ◄── GND  (pin 6)
                       SDA ◄── SDA  (pin 3)  [bus partagé]
                       SCL ◄── SCL  (pin 5)  [bus partagé]
                       ADDR ── 3.3V (→ 0x5B)

Mapping canaux → (corde, section) :
  Chip A canal  0-5  → corde 0 sections 0-5
  Chip A canal  6-11 → corde 1 sections 0-5
  Chip B canal  0-5  → corde 2 sections 0-5
  Chip B canal  6-11 → corde 3 sections 0-5
```

### Potentiomètres via MCP3008 (SPI) ou ADS1115 (I2C)

```
Option A : MCP3008 (SPI)
─────────────────────────
Raspberry Pi          MCP3008
MOSI (pin 19) ──────► DIN
MISO (pin 21) ◄────── DOUT
SCLK (pin 23) ──────► CLK
CE0  (pin 24) ──────► CS/SHDN
3.3V (pin 1)  ──────► VDD + VREF
GND  (pin 6)  ──────► DGND + AGND
Canaux CH0-CH4 → 5 potentiomètres

Option B : ADS1115 (I2C, plus précis, 16 bits)
───────────────────────────────────────────────
Partage le bus I2C avec les MPR121
Adresse par défaut : 0x48
Canaux A0-A3 → 4 potentiomètres max (5e sur un 2e ADS1115 à 0x49)
```

---

## Dépannage courant

### Le backend ne démarre pas

```
ModuleNotFoundError: No module named 'fastapi'
```
→ Le virtualenv n'est pas activé. Lancer `.venv\Scripts\activate` (Windows) ou `source .venv/bin/activate` (Linux/Pi).

---

### Pas de son

- Vérifier que `sounddevice` est installé : `pip show sounddevice`
- Sur le Pi, vérifier la sortie audio : `aplay -l`
- Sur Windows, vérifier que le device audio par défaut est actif

---

### MPR121 non détecté

```bash
i2cdetect -y 1
```
Doit afficher `5a` et `5b`. Sinon :
- Vérifier le câblage SDA/SCL
- Vérifier que l'I2C est activé : `sudo raspi-config` → Interface Options → I2C
- Vérifier l'adresse ADDR (GND=0x5A, 3.3V=0x5B, SDA=0x5C, SCL=0x5D)

---

### Les touches sont trop sensibles / pas assez

Modifier `touch.threshold` et `touch.release` via `PUT /api/config` ou depuis le ConfigEditor du frontend. Utiliser le CalibMonitor pour observer les valeurs brutes en temps réel.

---

### Le service systemd ne démarre pas

```bash
sudo journalctl -u omnibasse -n 50
```
Causes fréquentes :
- Chemin du virtualenv incorrect dans `omnibasse.service`
- Permissions sur `/home/pi/omnibasse`
- Port 8000 déjà utilisé : `ss -tlnp | grep 8000`

---

## Licence

Projet pédagogique — usage interne lycée.
