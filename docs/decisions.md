# Décisions techniques et justifications des bibliothèques

Règle imposée par le prompt de démarrage : **open source uniquement, licences compatibles MIT**, et chaque bibliothèque ajoutée doit être justifiée ici.

> Exception assumée : **MATLAB/Simulink** est propriétaire mais imposé par le cadrage OSI 2027 pour la simulation. Il n'entre pas dans la stack applicative livrée ; une alternative Python libre est fournie dans [simulations.md](simulations.md).

---

## 1. Backend Python

| Bibliothèque | Version min. | Licence | Rôle | Pourquoi ce choix | Alternative écartée |
| --- | --- | --- | --- | --- | --- |
| `fastapi` | 0.111 | MIT | API REST + WebSocket, validation automatique | Contrat d'API déjà défini dans le doc source ; naturel pour Pydantic et uvicorn | Flask (WebSocket moins intégré), Django (trop lourd) |
| `uvicorn[standard]` | 0.29 | BSD-3-Clause | Serveur ASGI | Serveur de référence de FastAPI, performant en local et sur Pi | Gunicorn seul (ASGI en plus nécessaire) |
| `pydantic` | 2.0 | MIT | Modèles `AppConfig`, `TouchEvent`, `PotEvent` | Validation des événements et de la config versionnée ; erreurs explicites | `dataclasses` seuls (pas de validation) |
| `pydantic-settings` | 2.0 | MIT | Variables d'environnement | Prévu pour `OMNIBASSE_INPUT` (voir M-13) | `os.environ` brut (pas de typage) |
| `numpy` | 1.26 | BSD-3-Clause | Samples float32, mixage, resampling | Base numérique commune audio et simulation | Listes Python (trop lentes) |
| `scipy` | 1.12 | BSD-3-Clause | `butter`, `lfilter`, `resample_poly` | Filtre audio et pitch-shift de qualité, déjà utilisés dans `audio_engine.py` | Réimplémentation IIR à la main |
| `sounddevice` | 0.4.6 | MIT | Sortie audio PortAudio | Interface simple, bloc de 512 échantillons, disponible sur Windows et Pi | `pygame.mixer` (latence moins maîtrisable), `pyaudio` (installation plus lourde) |
| `python-multipart` | 0.0.9 | Apache-2.0 | Upload WAV multipart | Nécessaire si `POST /api/samples` accepte un fichier (M-12) | Encodage base64 manuel |
| `websockets` | 12.0 | BSD-3-Clause | Transport WebSocket | Client/serveur local pour le simulateur | `socket.io` (protocole supplémentaire) |
| `smbus2` | optional | MIT | I2C vers les 2 MPR121 sur Pi | Pur Python, suffisant pour 0x5A/0x5B | `adafruit-circuitpython-mpr121` (dépendance en plus, voir O6) |
| `adafruit-circuitpython-mpr121` | — | MIT | Alternative de lecture MPR121 | Citée dans le doc source si `smbus2` insuffisant | À n'ajouter que si besoin |
| `adafruit-circuitpython-ads1x15` | — | MIT | ADC 16 bits pour pots | Plus précis que MCP3008 mais 4 canaux seulement → 2 ADC pour 5 pots | MCP3008 (SPI, 8 canaux, 10 bits) |
| `pytest` | à ajouter | MIT | Tests unitaires et d'intégration | Imposé par le prompt phase 1/2 | `unittest` stdlib (moins lisible) |
| `requests` | à ajouter | Apache-2.0 | Relevé `GET /api/calibration` dans `simulations/releve_calibration.py` | Simple pour un script de mesure occasionnel | `httpx` (déjà transitif via FastAPI mais API asynchrone) |
| `matplotlib` | à ajouter | PSF-based (compatible) | Courbes des CSV de mesure | Traçage rapide des comparaisons simulation/réel | Excel (moins reproductible) |

### Ajouts à faire dans `backend/requirements.txt`

```txt
pytest>=8.0
requests>=2.31
matplotlib>=3.8
pydantic-settings>=2.0   # déjà présent mais non utilisé
```

---

## 2. Frontend

| Bibliothèque | Version | Licence | Rôle | Pourquoi ce choix | Alternative écartée |
| --- | --- | --- | --- | --- | --- |
| `react` / `react-dom` | 18.3 | MIT | Interface de test | Écosystème connu, composants pour la grille et les sliders | Vue, Svelte (pas de gain ici) |
| `typescript` | 5.5 | Apache-2.0 | Typage des événements `TouchEvent` / `PotEvent` | Sécurité sur le contrat d'API partagé | JavaScript seul |
| `vite` | 5.4 | MIT | Serveur de dev et build | Démarrage rapide, HMR, déjà configuré | Webpack (plus lourd) |
| `@vitejs/plugin-react` | 4.3 | MIT | Support React/JSX dans Vite | Compagnon officiel de Vite | — |
| Web Audio API | natif | — | Écoute dans le navigateur | Pas de dépendance, latence faible, utile avant le Pi | Lecteur `<audio>` (moins flexible) |

---

## 3. Choix d'architecture

| Décision | Retenu | Justification |
| --- | --- | --- |
| Source d'entrée | Interface `HardwareBackend` avec `MockHardware` et `MPR121HardwarePi` | Le cœur ne connaît pas le matériel ; le simulateur remplace la surface sans changer l'audio. |
| Sélection de source | Variable `OMNIBASSE_INPUT` (`hardware` / `simulator`), simulator par défaut selon le doc | **À implémenter** : le code détecte aujourd'hui automatiquement I2C (voir M-13). |
| Configuration | JSON versionné `schema_version = 1`, validé par Pydantic, appliqué à chaud | Évite les redémarrages pendant les essais ; traçabilité des réglages. |
| Quantification | Gammes définies dans `scales.py`, 6 notes pour `minor_pentatonic_octave` | Correspond exactement aux 6 sections. |
| Position | Barycentre des 6 pads, pas rapport 2 pads | Conforme au code réel (`touch_engine._interpolate_pos`) ; le rapport du doc est conservé comme variante pédagogique. |
| Arbitrage | Corde au signal maximal uniquement | Répond au risque des bandes de 11–12 mm. |
| Audio | Samples WAV en RAM, polyphonie 4, pitch-shift par resampling | Suffisant pour la v1 ; passage à Rust `cpal` seulement si la latence dépasse 20 ms. |
| Filtre | Deux filtres distincts : passe-bas capacitif à modéliser (M-03) et filtre audio Butterworth déjà présent | Ne pas confondre les deux dans le dossier OSI. |
| Mesures | Horodatage à chaque étage + CSV + rejeu | Exigence directe du cahier des charges (EX-11). |
| Simulink | Une simulation principale + 3 secondaires | Conforme au cadrage « une entrée, une sortie, paramètres justifiés ». |

---

## 4. Licences des samples

Les samples livrés doivent être soit générés (synthèse, voir M-07), soit clairement libres de droits. À noter dans ce tableau avant d'ajouter un fichier WAV externe :

| Banque | Origine | Licence | Fichiers |
| --- | --- | --- | --- |
| `bass-default` | À générer par script | Produit propre | `0.wav` … `5.wav` |
