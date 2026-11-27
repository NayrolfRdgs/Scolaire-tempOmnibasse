# Contrat d'API

Le back expose une API REST pour la configuration et un WebSocket `/ws` pour les événements en direct. Les mêmes formats sont utilisés par le matériel et par le simulateur.

> Écart connu : les routes `recording` et `metrics` du doc source ne sont pas encore implémentées. Voir [manquant_logiciel.md](manquant_logiciel.md#m-01--routes-denregistrement-et-export-csv).

## REST

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/config` | Lire la configuration complète (`AppConfig`) |
| `PUT` | `/api/config` | Mettre à jour la configuration (validation Pydantic + application à chaud) |
| `GET` | `/api/state` | État courant du moteur (mode, gamme, banque, clients WS) |
| `GET` | `/api/calibration` | 24 valeurs brutes MPR121 (delta capacitif) et seuil actuel |
| `GET` | `/api/samples` | Liste des banques disponibles et banque active |
| `POST` | `/api/samples` | Change la banque active (le doc source annonce un upload WAV, voir M-12) |

## WebSocket `/ws`

Connexion persistante bidirectionnelle. Le frontend envoie des événements simulés ; le back les diffuse à tous les clients connectés.

### Événement `touch` (simulateur → backend)

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

### Événement `pot`

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

### Événements sortants

Le back renvoie les mêmes objets avec `source: "hardware"` ou `"simulator"`. Le champ `timing` prévu par le cahier des charges n'est pas encore présent (voir M-02).

---

## Configuration (`AppConfig`)

Fichier JSON retourné par `GET /api/config`, modifiable via `PUT /api/config`, persisté dans `backend/config.json`.

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

### Gammes disponibles (`scale.mode`)

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

## Routages associés

- Installation : [installation.md](installation.md)
- Câblage et mapping des canaux : [hardware.md](hardware.md)
- Utilisation depuis le navigateur : [interface_web.md](interface_web.md)
