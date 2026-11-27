# Écart logiciel détaillé — état actuel, cible et plan de travail

Ce document compare le **doc source**, le [cahier des charges](cahier_des_charges.md) et le **code réellement présent** dans `backend/` et `frontend/`. Il ne décrit pas des idées générales : chaque ligne indique le fichier concerné, l'impact OSI et un critère d'acceptation.

Légende de priorité :

| Priorité | Signification |
| --- | --- |
| **P0** | Bloque les mesures ou la conformité au cahier des charges. À faire en premier. |
| **P1** | Bloque la démonstration complète (son, interface de mesure). |
| **P2** | Qualité / conformité au prompt Antigravity (tests, licence, contrat d'API). |
| **P3** | Dépend du matériel ou d'une décision coûteuse. |

Statut : **Fait** = livré avec ce dossier `docs/` ; **À faire** = absente du code ; **Partiel** = existe mais incomplet.

---

## 1. Synthèse

| ID | Écart | Priorité | Statut | Exigence impactée | Fichiers concernés | Complexité |
| --- | --- | --- | --- | --- | --- | --- |
| M-01 | Routes d'enregistrement et export CSV | **P0** | À faire | EX-11, EX-01 | `backend/main.py`, `backend/config.py` | Moyenne |
| M-02 | Champ `timing` et délais par étage | **P0** | À faire | EX-01 | `config.py`, `main.py`, `audio_engine.py` | Moyenne |
| M-03 | Filtre passe-bas réglable sur les pads | **P0** | À faire | EX-01, EX-03, EX-04 | `touch_engine.py`, `config.py`, `main.py` | Moyenne |
| M-04 | Hystérésis de position non appelée | **P0** | Partiel | EX-06 | `touch_engine.py` | Faible |
| M-05 | Onglet **Mesures** dans le frontend | **P1** | À faire | EX-11 | `frontend/src/App.tsx`, `api.ts`, nouveau `MesuresPanel.tsx` | Moyenne |
| M-06 | `WebAudioPlayer.tsx` non branché | **P1** | Partiel | F6, EX-10 | `frontend/src/App.tsx` | Faible |
| M-07 | Samples WAV absents | **P1** | À faire | F6, EX-05 | `backend/samples/bass-default/`, nouveau `generate_samples.py` | Faible |
| M-08 | Tests pytest absents | **P2** | À faire | Prompt phase 1/2 | `backend/tests/` | Moyenne |
| M-09 | `docs/decisions.md` | **P2** | **Fait** | EX-12 | `docs/decisions.md` | — |
| M-10 | `backend/config.json` par défaut absent | **P2** | À faire | EX-09 | `backend/config.json` | Faible |
| M-11 | ADC des 5 potentiomètres non implémenté | **P3** | À faire | F7, F10 | `hardware/adc.py`, `hardware/mpr121.py` | Moyenne |
| M-12 | `POST /api/samples` n'uploade pas de WAV | **P2** | Partiel | Contrat d'API | `backend/main.py` | Faible |
| M-13 | `OMNIBASSE_INPUT` non utilisé | **P2** | À faire | Règle d'architecture 2 | `main.py`, `hardware/__init__.py` | Faible |
| M-14 | Dépendances de test/mesure manquantes | **P2** | À faire | EX-11, M-08 | `backend/requirements.txt` | Faible |

---

## 2. Fiches détaillées

### M-01 — Routes d'enregistrement et export CSV

**État actuel.** `main.py` expose `/api/config`, `/api/state`, `/api/calibration`, `/api/samples`, `/ws`. Les routes du doc source (`POST /api/recording/start`, `POST /api/recording/stop`, `GET /api/recording/{id}.csv`, `POST /api/replay/{id}`) n'existent pas. Le journal d'événements du frontend ne peut donc pas être téléchargé ni rejoué.

**Cible.** Enregistrer les valeurs brutes et filtrées de chaque pad avec horodatage, arrêter, exporter en CSV, et rejouer l'enregistrement comme source d'entrée du simulateur.

**Impact.** EX-11 est l'exigence qui permet de produire les courbes `mesurées vs simulées` du dossier OSI. Sans elle, les mesures restent des captures d'écran.

**Proposition d'implémentation.**

```python
# config.py — ajout
class RecordingInfo(BaseModel):
    id: str
    started_at: float
    stopped_at: float | None = None
    samples: int

class SampleRow(BaseModel):
    t: float
    pad: int          # 0..23
    brut: int         # delta MPR121
    filtre: float     # sortie du filtre M-03
```

```python
# main.py — état global
_recordings: dict[str, list[dict[str, float | int]]] = {}
_recording_id: str | None = None

@app.post("/api/recording/start")
async def recording_start() -> RecordingInfo: ...

@app.post("/api/recording/stop")
async def recording_stop() -> RecordingInfo: ...

@app.get("/api/recording/{rid}.csv")
async def recording_csv(rid: str) -> Response:
    # colonnes : t,pad,brut,filtre
    ...

@app.post("/api/replay/{rid}")
async def replay(rid: str) -> dict[str, str]:
    # réinjecte les lignes dans TouchEngine à la même cadence
    ...
```

Dans `_hardware_loop()`, ajouter l'écriture des 24 lignes par trame quand `_recording_id` est non nul, **avant** `process_raw()` afin de garder le brut et le filtré (M-03).

**Critères d'acceptation.**
1. `start` → 20 touchers → `stop` renvoie un `id`.
2. Le CSV a exactement les colonnes `t,pad,brut,filtre` et 24 lignes par trame à 100 Hz.
3. `POST /api/replay/{id}` déclenche les mêmes événements que ceux enregistrés (comparaison des `section` et `pos`).
4. Un enregistrement non existant renvoie 404.

---

### M-02 — Horodatage par étage et `/api/metrics`

**État actuel.** `TouchEvent` contient `t` (horodatage unique) mais aucun détail. `GET /api/metrics` n'existe pas. Impossible de savoir où se perdent les 20 ms.

**Cible.** Chaque événement porte `timing = {t_sensor, t_emit, t_audio}` et l'API expose les statistiques par étage.

**Impact.** EX-01 et le budget de latence du [§ 7 de simulations.md](simulations.md#7-simulation-4--budget-de-latence).

**Proposition.**

```python
# config.py — TouchEvent
timing: dict[str, float] | None = Field(default=None)
```

 Dans `_hardware_loop()` :

```python
t_sensor = time.time()
raw = await asyncio.to_thread(_hardware.read_raw)
filtra = filtre(raw)                 # M-03
t_emit = time.time()
events = _touch_engine.process_raw(filtra)
for evt in events:
    t_audio = _handle_audio_event(evt)   # audio_engine.play() renvoie time.time()
    evt.timing = {"t_sensor": t_sensor, "t_emit": t_emit, "t_audio": t_audio}
    await _ws_manager.broadcast(evt.model_dump())
```

`GET /api/metrics` renvoie, pour les N derniers événements :

```json
{
  "n": 20,
  "moyenne_ms": {"capteur": 0.4, "traitement": 0.7, "avant_audio": 1.1, "total": 13.2},
  "max_ms": {"capteur": 0.6, "traitement": 1.0, "avant_audio": 1.5, "total": 15.0}
}
```

**Limite à documenter.** `t_audio` mesuré à l'appel de `play()` n'est pas exactement le premier échantillon sortant : le tampon de 512 échantillons (11,61 ms) s'ajoute. La mesure externe P4 reste nécessaire.

**Critères d'acceptation.**
1. Tous les événements `down` ont un `timing` non nul.
2. `t_sensor ≤ t_emit ≤ t_audio` pour chaque événement.
3. `/api/metrics` renvoie des valeurs numériques après au moins un toucher.

---

### M-03 — Filtre passe-bas réglable sur les valeurs brutes

**État actuel.** `audio_engine.py` contient un filtre Butterworth **audio** (200 Hz–8 kHz) branché sur le pot `filter`. Le traitement capacitif, lui, n'a aucun filtre configurable. La simulation modélise `1/(tau·s+1)` sur les pads, donc les deux chaînes ne correspondent pas.

**Cible.** Un filtre passe-bas du premier ordre, avec `tau` dans la configuration, appliqué aux 24 deltas avant détection/interpolation.

**Impact.** EX-01, EX-03, EX-04. C'est le point le plus important pour que le dossier soit scientifiquement cohérent.

**Proposition.**

```python
# config.py — TouchConfig
filter_tau: float = Field(0.008, ge=0.0, le=0.2,
                          description="Constante de temps du filtre capacitif (s)")

# nouveau backend/filters.py
class PadsLowPass:
    def __init__(self, tau: float, Ts: float = 0.01) -> None:
        self.a = Ts / (tau + Ts) if tau > 0 else 1.0
        self.y: dict[int, float] = {}

    def __call__(self, raw: dict[int, int]) -> dict[int, float]:
        out = {}
        for ch, v in raw.items():
            prev = self.y.get(ch, float(v))
            out[ch] = self.a * v + (1 - self.a) * prev
            self.y[ch] = out[ch]
        return out
```

Dans `main.py`, instancier le filtre au démarrage, l'appeler dans `_hardware_loop()`, et transmettre les valeurs filtrées à `process_raw()`. Mettre à jour le filtre quand `PUT /api/config` change `filter_tau`.

**Critères d'acceptation.**
1. Avec `filter_tau = 0`, la sortie est identique aux valeurs brutes actuelles (non-régression).
2. Avec un échelon, la sortie atteint 63,2 % de la cible après `tau` (test unitaire).
3. La valeur de `tau` mesurée en P3 est celle utilisée dans Simulink.

---

### M-04 — Hystérésis de position jamais appelée

**État actuel.** `TouchEngine._apply_hysteresis(pos, last_pos)` existe (`touch_engine.py` ligne 236) mais aucune méthode ne l'appelle. `config.touch.hysteresis = 0,05` est donc sans effet.

**Cible.** En mode libre, un `move` n'est émis que si `|pos − dernier_pos| ≥ hysteresis`.

**Impact.** EX-06 : sans cela, le bruit du capteur produit des micro-mouvements.

**Proposition.**
1. Ajouter `last_pos: Optional[float]` à `StringState`.
2. Dans la branche `move`, remplacer `pos` par `pos = self._apply_hysteresis(pos, state.last_pos)`.
3. Mettre à jour `state.last_pos = pos` seulement si le nouveau `pos` est accepté.
4. Réinitialiser `last_pos = None` sur `up`.

**Critères d'acceptation.**
1. Deux trames avec `Δpos = 0,02` et `hysteresis = 0,05` → un seul événement.
2. Une trame avec `Δpos = 0,06` → nouvel événement.
3. Test unitaire dédié dans `backend/tests/test_touch_engine.py`.

---

### M-05 — Onglet Mesures dans le frontend

**État actuel.** `App.tsx` declare 4 onglets : `grid`, `calib`, `config`, `log`. Aucun onglet Mesures, aucun bouton enregistrer/rejouer/télécharger. `api.ts` ne contient pas les appels aux routes M-01.

**Cible.** Un cinquième onglet qui pilote l'enregistrement et affiche les métriques.

**Impact.** EX-11, ergonomie du dossier OSI (captures lisibles pour le jury).

**Proposition.**

```tsx
// frontend/src/components/MesuresPanel.tsx
// - bouton "Démarrer" -> POST /api/recording/start
// - bouton "Arrêter"  -> POST /api/recording/stop (affiche l'id)
// - lien "<id>.csv"   -> GET /api/recording/{id}.csv (download)
// - bouton "Rejouer"  -> POST /api/replay/{id}
// - tableau des délais renvoyés par GET /api/metrics
```

Ajouter dans `api.ts` :

```ts
export const startRecording = () => apiFetch<RecordingInfo>('/api/recording/start', { method: 'POST' })
export const stopRecording  = () => apiFetch<RecordingInfo>('/api/recording/stop',  { method: 'POST' })
export const getMetrics     = () => apiFetch<Metrics>('/api/metrics')
export const replayRecording = (id: string) => apiFetch(`/api/replay/${id}`, { method: 'POST' })
```

Ajouter `{ id: 'mesures', label: 'Mesures', icon: '⏱️' }` à `TABS` et le rendu conditionnel dans `App.tsx`.

**Critères d'acceptation.**
1. Les 4 boutons fonctionnent avec le backend M-01.
2. Le CSV téléchargé s'ouvre dans un tableur.
3. Le tableau des délais se rafraîchit après chaque mesure.

---

### M-06 — Lecture Web Audio non branchée

**État actuel.** `frontend/src/components/WebAudioPlayer.tsx` existe mais n'est importé nulle part dans `App.tsx`. L'écoute dans le navigateur (livrable de la phase 1 du prompt) est donc inactive.

**Cible.** Brancher le composant sur `lastMessage` pour entendre les samples sans le moteur audio du back.

**Impact.** F6 / EX-10 : permet de tester la page avant d'avoir le Raspberry Pi.

**Proposition.**
1. Importer `WebAudioPlayer` dans `App.tsx`.
2. Le rendre dans l'onglet `grid`, sous `TouchGrid`, avec `lastMessage={lastMessage}`.
3. Prévoir un bouton « Activer le son navigateur » (les navigateurs bloquent l'audio avant une interaction).

**Critères d'acceptation.** Un clic sur la grille produit un son Web Audio quand le back est arrêté.

---

### M-07 — Samples absents

**État actuel.** `backend/samples/bass-default/` ne contient qu'un `.gitkeep`. `AudioEngine.load_bank()` logge « Sons silencieux ». Aucun son pendant la démonstration.

**Cible.** 6 fichiers `0.wav` … `5.wav` générés synthétiquement, correspondant aux 6 notes de la corde 0 en pentatonique mineure + octave : E1, G1, A1, B1, D2, E2.

**Impact.** F6, EX-05. Répond aussi à la question ouverte O3 (synthétique plutôt que basse enregistrée, gratuit et libre de droits).

**Proposition.** Script `backend/generate_samples.py` :

```python
import math, struct, wave
NOTES = [41.203, 49.0, 55.0, 61.735, 73.416, 82.407]  # E1..E2
SR, DUREE = 44100, 1.0
for i, f in enumerate(NOTES):
    with wave.open(f"samples/bass-default/{i}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        frames = []
        for n in range(int(SR * DUREE)):
            t = n / SR
            env = math.exp(-3 * t)
            v = (math.sin(2*math.pi*f*t) + 0.3*math.sin(4*math.pi*f*t)) * env * 0.6
            frames.append(struct.pack("<h", int(max(-1, min(1, v)) * 32767)))
        w.writeframes(b"".join(frames))
```

**Critères d'acceptation.**
1. `GET /api/samples` renvoie `["bass-default"]`.
2. Un toucher sur la section 0 produit un son audible.
3. Les fichiers sont générés par script, donc reproductibles et libres de droits (noté dans `decisions.md`).

---

### M-08 — Tests pytest

**État actuel.** Aucun dossier `tests/`, `pytest` absent de `requirements.txt`.

**Cible.** Couvrir les quatre domains imposés par le prompt + intégration WebSocket.

| Fichier | Test | Assertion |
| --- | --- | --- |
| `tests/test_scales.py` | `test_pentatonic_six_notes` | `get_scale_notes("E","minor_pentatonic_octave",6) == ["E1","G1","A1","B1","D2","E2"]` |
| `tests/test_scales.py` | `test_note_to_freq_e1` | `note_to_freq("E1") ≈ 41.203` |
| `tests/test_scales.py` | `test_ratio_octave` | `freq_ratio("E1","E2") ≈ 2` |
| `tests/test_touch_engine.py` | `test_interpolation_centre` | 6 pads, seul le pad 2 à 100 → `pos = 0.4` |
| `tests/test_touch_engine.py` | `test_dominant_string` | deux cordes touchées → un seul événement, sur la plus forte |
| `tests/test_touch_engine.py` | `test_down_move_up` | séquence de trames → états `down`, `move`, `up` |
| `tests/test_touch_engine.py` | `test_hysteresis` | voir M-04 |
| `tests/test_filters.py` | `test_tau_632` | échelon → 63,2 % après `tau` (M-03) |
| `tests/test_filters.py` | `test_tau_zero_identity` | `tau = 0` → sortie = entrée |
| `tests/test_api.py` | `test_get_config_schema` | `GET /api/config` → `schema_version = 1` |
| `tests/test_api.py` | `test_put_config_hot` | `PUT` change `play_mode` sans redémarrage |
| `tests/test_api.py` | `test_ws_simulator_event` | événement envoyé → rebroadcast avec `source="simulator"` |
| `tests/test_api.py` | `test_recording_roundtrip` | start → stop → CSV → replay (M-01) |

Lancement : `python -m pytest backend/tests -v`.

---

### M-09 — Justification des bibliothèques

**État actuel.** Le prompt impose `docs/decisions.md` : « Tu peux ajouter des bibliothèques, mais justifie chacune ». Le fichier n'existait pas.

**Cible.** Table des licences, rôle et alternatives écartées.

**Statut : FAIT** — voir [decisions.md](decisions.md). À remettre à jour à chaque nouvelle dépendance (pytest, requests, matplotlib notably).

---

### M-10 — Configuration par défaut persistée

**État actuel.** `CONFIG_PATH = backend/config.json`. Le fichier n'existe pas au départ ; `_load_config()` utilise les valeurs Pydantic par défaut et le fichier n'est créé qu'au premier `PUT /api/config`.

**Cible.** `backend/config.json` versionné, identique à la configuration de référence du README, chargé au démarrage.

**Contenu à créer.** Le JSON complet `schema_version = 1`, `layout 4×6`, cordes E1/A1/D2/G2, gamme `minor_pentatonic_octave`, `play_mode = "notes"`, `threshold 12`, `release 6`, `hysteresis 0,05`, `filter_tau` (M-03), pots 0–4, banque `bass-default`.

**Critères d'acceptation.** Supprimer le fichier puis le recréer depuis le dépôt ne change pas le comportement au démarrage.

---

### M-11 — ADC des potentiomètres

**État actuel.** `MPR121HardwarePi.read_pots()` renvoie des valeurs fixes (`volume 0.8`, `filter 1.0`, `reverb 0.0`, `bank 0.0`, `key 0.5`). `MockHardware.set_pot()` fonctionne, mais aucun ADC n'est lu.

**Cible.** Lecture réelle de 5 potentiomètres.

**Impact.** F7 / F10. Point ouvert O6 : ADS1115 (I2C, 16 bits, 4 canaux → 2 puces pour 5 pots) ou MCP3008 (SPI, 10 bits, 8 canaux → 1 puce).

**Proposition.** Nouveau `hardware/adc.py` avec une classe `AnalogInputs` implémentant `read() -> dict[str, float]`, injectée dans `create_hardware_backend()`. Le choix se fait par variable d'environnement `OMNIBASSE_ADC = ads1115 | mcp3008 | none`.

**Critères d'acceptation.** Tourner un potentiomètre modifie `GET /api/state` et le son (volume) ou le filtre audio en moins d'une trame.

---

### M-12 — Contrat de `POST /api/samples`

**État actuel.** La route attend `{"bank": "nom"}` et change la banque active. Le doc source annonce « Envoyer un sample WAV ».

**Cible.** Accepter un upload `multipart/form-data` : nom de banque + fichier WAV, le valider (durée, mono, 44,1 kHz), l'enregistrer dans `samples/<banque>/<section>.wav`, puis recharger la banque.

**Impact.** Cohérence du contrat d'API ; permet d'utiliser une vraie basse enregistrée (O3) sans modifier le code.

**Critères d'acceptation.** Après upload, `GET /api/samples` liste la banque et le son joué correspond au fichier envoyé. Conserver l'ancien comportement de changement de banque sous une autre route pour ne pas casser le frontend.

---

### M-13 — Variable `OMNIBASSE_INPUT`

**État actuel.** `create_hardware_backend()` auto-détecte `smbus2` et `/dev/i2c-1`. Le doc source impose `OMNIBASSE_INPUT = hardware | simulator`, avec `simulator` par défaut.

**Cible.** Lecture de la variable (via `pydantic-settings` déjà dans les requirements) avec priorité sur l'auto-détection.

**Impact.** Règle d'architecture n° 2 : « la même source d'entrée se choisit par variable d'environnement ».

**Critères d'acceptation.** Forcer `OMNIBASSE_INPUT=simulator` sur le Pi → aucun accès I2C au démarrage ; forcer `hardware` sur un PC sans I2C → erreur explicite au lieu d'un fallback silencieux.

---

### M-14 — Dépendances manquantes

**État actuel.** `requirements.txt` contient FastAPI, uvicorn, Pydantic, pydantic-settings, numpy, sounddevice, scipy, python-multipart, websockets. Il manque `pytest` (tests), `requests` (script de relevé) et `matplotlib` (courbes).

**Cible.** Ajouts listés dans [decisions.md](decisions.md#1-backend-python).

**Critères d'acceptation.** `pip install -r requirements.txt` puis `python -m pytest backend/tests -v` et `python simulations\releve_calibration.py` fonctionnent sans `ModuleNotFoundError`.

---

## 3. Plan de travail

| Phase | Contenu | Livrable | Critère de sortie |
| --- | --- | --- | --- |
| **A — Mesures** | M-01, M-02, M-03, M-04, M-14 | Back instrumenté | CSV + `timing` + `tau` configurable ; tests M-03/M-04 verts |
| **B — Démonstration** | M-05, M-06, M-07, M-10 | Frontend complet + son | Onglet Mesures fonctionnel, samples audibles |
| **C — Qualité** | M-08, M-12, M-13 | Tests verts + contrat cohérent | `pytest` vert, API conforme au doc |
| **D — Matériel** | M-11 + prototype cuivre | Pots réels + courbes | Mesures P1–P6 archivées dans `docs/mesures/` |

---

## 4. Matrice de traçabilité

| Exigence | Écarts à lever | Simulation | Mesure |
| --- | --- | --- | --- |
| EX-01 Réactivité | M-01, M-02, M-03 | § 4 et § 7 | P4 |
| EX-02 Distinction zones | M-04 (indirect) | — | P5 |
| EX-03 Précision | M-03, M-04 | § 4 | P6 |
| EX-04 Robustesse | M-01, M-03 | § 4 (bruit) | P2 |
| EX-05 Plage 24 notes | M-07 | § 6 | Journal WS |
| EX-06 Glissement | M-04 | § 4 (rampe) | P6 |
| EX-07 Arbitrage | Aucun (déjà conforme) | — | P5 |
| EX-08 Audio | M-07 | § 7 | P4 |
| EX-09 Config à chaud | M-10 | — | Test API |
| EX-10 Sans matériel | M-06, M-13 | — | Lancement Windows |
| EX-11 Traçabilité | M-01, M-05 | — | CSV |
| EX-12 Décisions | M-09 (**fait**) | — | `docs/decisions.md` |

---

## 5. Décisions à trancher avant la phase A

| Question | Pourquoi cela bloque | Réponse attendue |
| --- | --- | --- |
| `filter_tau` par défaut à 0,008 s ? | Valeur provisoire dans M-03 et Simulink | Remplacer par le résultat P3 |
| Faut-il garder le rapport 2 pads dans le dossier ? | Deux formules coexistent | Garder comme variante pédagogique, barycentre pour la comparaison (décision déjà prise dans `decisions.md`) |
| Réduire le bloc audio à 256 échantillons ? | Condition pour tenir EX-01 | Décision après P4 |
| ADS1115 ou MCP3008 ? | Bloque M-11 et le câblage | Voir O6 du cahier des charges |
| Nombre d'essais EX-02 et tolérance EX-03 | Bloque la validation | Lecture de la notice UPSTI + enseignant |
