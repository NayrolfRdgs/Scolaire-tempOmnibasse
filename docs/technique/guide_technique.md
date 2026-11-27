# Guide technique

Tout ce qui sert à installer, lancer, brancher et utiliser le projet. Les documents du projet OSI (cahier des charges, simulations, mesures, suivi) sont dans [`../projet/`](../projet/).

- [Installation et lancement](#installation-et-lancement)
- [Architecture](#architecture)
- [Contrat d'API](#contrat-dapi)
- [Matériel et câblage](#matériel-et-câblage)
- [Interface web de test](#interface-web-de-test)
- [Dépannage courant](#dépannage-courant)

---

## Installation et lancement

### Prérequis

| Environnement | Versions |
| --- | --- |
| Windows (développement) | Python 3.10+, Node.js 18+, npm |
| Raspberry Pi (production) | Raspberry Pi 4 ou 5, Python 3.10+, carte son USB ou DAC, I2C activé |

### Développement Windows

**Backend**

```bat
cd G:\.Pro\.Dev\Lycee\OM\backend

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt
copy .env.example .env

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Le raccourci `start_dev.bat` fait la même chose.

**Frontend**

```bat
cd G:\.Pro\.Dev\Lycee\OM\frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173. Le raccourci `start_frontend.bat` lance également le frontend.

À ce stade, `MockHardware` est utilisé automatiquement : aucun MPR121 n'est nécessaire. Les gestes sont simulés depuis la grille web.

### Raspberry Pi

Le dépôt est **privé** : le clone nécessite un token ou des identifiants GitHub autorisés.

```bash
git clone https://github.com/NayrolfRdgs/Scolaire-tempOmnibasse.git /home/pi/omnibasse
cd /home/pi/omnibasse/backend

chmod +x install_pi.sh
sudo ./install_pi.sh
```

Le script :

1. installe les dépendances système (`i2c-tools`, `python3-venv`, …) ;
2. active le bus I2C ;
3. crée le virtualenv et installe les paquets Python ;
4. installe et active le service systemd `omnibasse`.

Vérification du service :

```bash
sudo systemctl status omnibasse
sudo journalctl -u omnibasse -f
```

Le démarrage automatique est décrit dans `backend/omnibasse.service`.

---

## Architecture

### Vue d'ensemble

```text
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

### Couches

| Couche | Rôle | Choix |
| --- | --- | --- |
| Entrées | Lire MPR121 et ADC, ou recevoir les gestes du navigateur | `HardwareBackend` : `MockHardware` / `MPR121HardwarePi` |
| Cœur | Quantification, hystérésis, interpolation, mapping | `config.py`, `scales.py`, `touch_engine.py` |
| Audio | Charger les WAV en RAM, jouer, transposer, filtrer | `audio_engine.py` (`sounddevice` + NumPy/SciPy) |
| API | REST pour la configuration, WebSocket pour le direct | `main.py`, `ws_manager.py` |
| Interface de test | Surface simulée, sliders, calibration, journal | React + Vite + TypeScript |

### Règles d'architecture

1. Le cœur ne connaît pas le matériel : il ne consomme que des événements normalisés.
2. Le même back tourne sur le PC et sur le Raspberry Pi ; la source d'entrée doit pouvoir être choisie par `OMNIBASSE_INPUT` (voir [M-13](../projet/manquant_logiciel.md#m-13--variable-omnibasse_input)).
3. La configuration est un JSON versionné (`schema_version`), validé par Pydantic et appliqué à chaud.

### Structure du dépôt

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

Les justifications des bibliothèques sont dans [decisions.md](../projet/decisions.md).

---

## Contrat d'API

Le back expose une API REST pour la configuration et un WebSocket `/ws` pour les événements en direct. Les mêmes formats sont utilisés par le matériel et par le simulateur.

> Écart connu : les routes `recording` et `metrics` du doc source ne sont pas encore implémentées. Voir [M-01](../projet/manquant_logiciel.md#m-01--routes-denregistrement-et-export-csv).

### REST

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/config` | Lire la configuration complète (`AppConfig`) |
| `PUT` | `/api/config` | Mettre à jour la configuration (validation Pydantic + application à chaud) |
| `GET` | `/api/state` | État courant du moteur (mode, gamme, banque, clients WS) |
| `GET` | `/api/calibration` | 24 valeurs brutes MPR121 (delta capacitif) et seuil actuel |
| `GET` | `/api/samples` | Liste des banques disponibles et banque active |
| `POST` | `/api/samples` | Change la banque active (le doc source annonce un upload WAV, voir M-12) |

### WebSocket `/ws`

Connexion persistante bidirectionnelle. Le frontend envoie des événements simulés ; le back les diffuse à tous les clients connectés.

Événement `touch` (simulateur → backend) :

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

- `state` : `down`, `move` ou `up`
- `string` : 0 à 3
- `section` : 0 à 5
- `pos` : 0 (bas de la bande) à 1 (haut)
- `pressure` : 0 à 1
- `source` : `hardware` ou `simulator`

Événement `pot` :

```json
{
  "type": "pot",
  "id": "volume",
  "value": 0.75,
  "source": "simulator",
  "t": 1700000000.456
}
```

`id` : `volume`, `filter`, `reverb`, `bank` ou `key`. `value` : 0 à 1.

Le back renvoie les mêmes objets avec `source: "hardware"` ou `"simulator"`. Le champ `timing` prévu par le cahier des charges n'est pas encore présent (voir M-02).

### Configuration (`AppConfig`)

Fichier JSON retourné par `GET /api/config`, modifiable via `PUT /api/config`, persisté dans `backend/config.json`. Chargé depuis ce fichier s'il existe, sinon depuis les valeurs par défaut de `backend/config.py`. Les variables d'environnement sont documentées dans `backend/.env.example`.

```json
{
  "schema_version": 1,
  "layout": { "strings": 4, "sections": 6 },
  "strings": [
    { "id": 0, "base_note": "E1" },
    { "id": 1, "base_note": "A1" },
    { "id": 2, "base_note": "D2" },
    { "id": 3, "base_note": "G2" }
  ],
  "scale": { "root": "E", "mode": "minor_pentatonic_octave" },
  "play_mode": "notes",
  "touch": { "threshold": 12, "release": 6, "hysteresis": 0.05 },
  "pots": [
    { "id": "volume",  "channel": 0 },
    { "id": "filter",  "channel": 1 },
    { "id": "reverb",  "channel": 2 },
    { "id": "bank",    "channel": 3 },
    { "id": "key",     "channel": 4 }
  ],
  "samples": { "bank": "bass-default" }
}
```

Gammes disponibles (`scale.mode`) :

| Clé | Description |
| --- | --- |
| `major` | Gamme majeure |
| `natural_minor` | Gamme mineure naturelle |
| `harmonic_minor` | Gamme mineure harmonique |
| `dorian` | Mode dorien |
| `phrygian` | Mode phrygien |
| `mixolydian` | Mode mixolydien |
| `minor_pentatonic` | Pentatonique mineure (5 notes) |
| `minor_pentatonic_octave` | Pentatonique mineure + octave (défaut, 6 notes) |
| `chromatic` | Chromatique (12 demi-tons) |

---

## Matériel et câblage

### Surface et capteurs

| Élément | Choix | Statut |
| --- | --- | --- |
| Surface | 4 bandes × 6 sections, ~400 mm × 45–50 mm | Validé |
| Pads | Ruban de cuivre au prototype, plaquettes de laiton ensuite ; ~64 mm × 9–10 mm, 2 mm d'écart | Validé |
| Capteurs | 2 × MPR121 en I2C, adresses `0x5A` et `0x5B` (24 canaux) | Validé |
| Cerveau | Raspberry Pi 4 ou 5 + carte son USB ou DAC | Validé |
| Potentiomètres | ADS1115 (I2C) ou MCP3008 (SPI), 5 entrées | À choisir (point O6) |
| Dynamique | Capteur de force FSR optionnel, sinon valeur de capacité | Option |

Les bandes font 11–12 mm chacune : un doigt peut toucher deux cordes. Le logiciel ne retient que la corde au signal le plus fort.

### MPR121 × 2 via I2C

```text
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
```

Mapping des canaux :

| Chip | Canaux | Cordes / sections |
| --- | --- | --- |
| A (`0x5A`) | 0–5 | corde 0, sections 0–5 |
| A (`0x5A`) | 6–11 | corde 1, sections 0–5 |
| B (`0x5B`) | 0–5 (canaux globaux 12–17) | corde 2, sections 0–5 |
| B (`0x5B`) | 6–11 (canaux globaux 18–23) | corde 3, sections 0–5 |

Le driver lit les registres *filtered data* et soustrait la *baseline* pour obtenir un delta positif au contact. Les registres de filtrage et de seuils sont configurés dans `backend/hardware/mpr121.py`.

### Potentiomètres

Option A — MCP3008 (SPI) :

```text
Raspberry Pi          MCP3008
MOSI (pin 19) ──────► DIN
MISO (pin 21) ◄────── DOUT
SCLK (pin 23) ──────► CLK
CE0  (pin 24) ──────► CS/SHDN
3.3V (pin 1)  ──────► VDD + VREF
GND  (pin 6)  ──────► DGND + AGND
Canaux CH0–CH4 → 5 potentiomètres
```

Option B — ADS1115 (I2C, 16 bits) : partage le bus I2C avec les MPR121. Adresse par défaut `0x48`. Quatre canaux A0–A3 : le 5ᵉ potentiomètre nécessite un second ADS1115 à `0x49`.

> La lecture ADC n'est pas encore implémentée : `read_pots()` renvoie des valeurs fixes. Voir [M-11](../projet/manquant_logiciel.md#m-11--adc-des-potentiomètres).

### Vérification et calibration

```bash
i2cdetect -y 1
```

Doit afficher `5a` et `5b`. Pour régler les seuils, utiliser le `CalibMonitor` du frontend puis modifier `touch.threshold` et `touch.release` via `PUT /api/config`. Protocole complet : [protocole_mesures.md](../projet/protocole_mesures.md).

---

## Interface web de test

La page React sert de surface simulée et de console de réglage. Elle se connecte au même back que le Raspberry Pi, via REST et WebSocket `/ws`. Lancement : voir [Installation et lancement](#installation-et-lancement), puis ouvrir http://localhost:5173.

| Onglet | Rôle | Composant |
| --- | --- | --- |
| **Surface de Jeu** | Grille 4 × 6. La souris ou le doigt glisse et envoie des événements `touch` avec une `pos` continue. | `TouchGrid.tsx` |
| **Capteurs MPR121** | Barres en direct des 24 valeurs brutes pour régler les seuils. | `CalibMonitor.tsx` |
| **Configuration** | Éditeur JSON ; envoie la configuration via `PUT /api/config`. | `ConfigEditor.tsx` |
| **Journal Direct** | Flux WebSocket en direct, jusqu'à 200 lignes, filtrable par source (`all`, `hardware`, `simulator`). | `EventLog.tsx` |

Le panneau latéral contient les 5 potentiomètres simulés : volume, filtre, réverbération, banque de samples et tonalité (`PotSliders.tsx`).

Prévu mais pas encore branché :

| Fonction | État |
| --- | --- |
| Écoute Web Audio dans le navigateur | Composant `WebAudioPlayer.tsx` présent mais non appelé — voir M-06 |
| Onglet **Mesures** (enregistrer, rejouer, délais, CSV) | À créer — voir M-05 |

Quand les MPR121 sont branchés, la même grille s'allume avec les touches réelles. Le journal permet de distinguer les événements `hardware` des événements `simulator`, ce qui sert à comparer les deux sources.

---

## Dépannage courant

### Le backend ne démarre pas

```text
ModuleNotFoundError: No module named 'fastapi'
```

Le virtualenv n'est pas activé.

- Windows : `.venv\Scripts\activate`
- Linux / Pi : `source .venv/bin/activate`

Puis réinstaller si besoin : `pip install -r requirements.txt`.

### Pas de son

- Vérifier `sounddevice` : `pip show sounddevice`
- Sur le Pi, lister les cartes son : `aplay -l`
- Sur Windows, vérifier le périphérique audio par défaut
- Vérifier que la banque est chargée : `GET /api/samples` doit renvoyer `bass-default`
- Attention : les WAV du back sont dans `backend/samples/` et sont ignorés par Git ; les WAV du navigateur sont dans `frontend/public/samples/`

Voir aussi [M-07](../projet/manquant_logiciel.md#m-07--samples-absents).

### MPR121 non détecté

```bash
i2cdetect -y 1
```

Doit afficher `5a` et `5b`. Sinon :

- vérifier le câblage SDA/SCL et l'alimentation 3,3 V ;
- activer l'I2C : `sudo raspi-config` → *Interface Options* → *I2C* ;
- vérifier la broche `ADDR` : GND = `0x5A`, 3,3 V = `0x5B`, SDA = `0x5C`, SCL = `0x5D`.

### Touches trop sensibles ou pas assez

Modifier `touch.threshold` et `touch.release` via `PUT /api/config` ou depuis l'onglet Configuration du frontend. Observer les valeurs brutes avec l'onglet Capteurs MPR121, puis suivre le [protocole P2](../projet/protocole_mesures.md#p2--bruit-sec--humide).

### Service systemd qui ne démarre pas

```bash
sudo journalctl -u omnibasse -n 50
```

Causes fréquentes :

- chemin du virtualenv incorrect dans `backend/omnibasse.service` ;
- permissions sur `/home/pi/omnibasse` ;
- port 8000 déjà utilisé : `ss -tlnp | grep 8000`.

### Latence supérieure à 20 ms

Le budget théorique est déjà de `10 ms` (boucle capteur) + `11,61 ms` (tampon audio) avant même le filtre et le traitement. Voir [simulations.md](../projet/simulations.md#7-simulation-4--budget-de-latence) puis mesurer avec le [protocole P4](../projet/protocole_mesures.md#p4--latence).

### Autres écarts connus

La liste complète des fonctionnalités manquantes ou partielles est dans [manquant_logiciel.md](../projet/manquant_logiciel.md).
