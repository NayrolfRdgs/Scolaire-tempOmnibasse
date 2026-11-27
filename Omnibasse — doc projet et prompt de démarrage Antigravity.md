# Omnibasse — doc projet et prompt de démarrage Antigravity

Nov 19, 2026 · @Flo

## Vision

L'Omnibasse est un instrument tactile joué au doigt, entre une basse et un Omnichord, qui pilote un sampler tournant sur un Raspberry Pi.

- **Surface** : 4 bandes (les cordes) × 6 sections, environ 40 cm de long sur 4,5 à 5 cm de large.
- **Jeu** : chaque section déclenche ou transpose un sample, quantifié sur une gamme (esprit Omnichord, on ne joue pas faux).
- **Réglages** : des potentiomètres pour le volume, le filtre, les effets, la banque de samples et la tonalité.
- **Glissement** : le doigt doit pouvoir glisser sur la surface pour jouer en continu. Cette partie est à moitié validée.
- **Développement** : le logiciel doit fonctionner avec ou sans le matériel. Une page web de test simule la surface avant le passage sur le Raspberry Pi.

## Cadre OSI 2027

Le projet sert aussi de dossier pour les Olympiades de sciences de l'ingénieur 2027 (thème « L'ingénierie au service de l'art »), ce qui impose un cahier des charges chiffré, une simulation Simulink et des mesures sur le prototype.

- Inscription sur Adage du 2 novembre 2026 au 13 mars 2027, faite par l'enseignant.
- Finale nationale fin mai 2027, équipe de 2 à 5 lycéens encadrés par 1 ou 2 enseignants.
- La grille d'évaluation des terminales n'a pas été trouvée : elle est dans la notice UPSTI, à lire avant de figer le dossier.

### Cahier des charges adapté à l'Omnibasse

| Exigence | Critère | Niveau | Vérification |
| --- | --- | --- | --- |
| Réactivité | Délai entre le toucher et le son | Moins de 20 ms | Horodatage à chaque étage du back, plus une mesure externe |
| Distinction des zones | Aucune zone voisine déclenchée par erreur | Zéro erreur sur un nombre d'essais à fixer | Essais en mode notes, journal d'événements |
| Précision de position | Écart entre la position réelle du doigt et `pos` | À mesurer, en mm | Repères sur la surface, mode libre |
| Robustesse | Doigt sec ou humide | À tester | Essais comparés sur les valeurs brutes enregistrées |
| Plage | Notes jouables | 24 (4 cordes × 6) | Quantification en mode notes |

Le critère d'exemple « distinguer chaque demi-ton » ne s'applique pas tel quel avec 6 sections de 64 mm : il est à adapter et à justifier, ou à couvrir par un mode chromatique de 12 pads pour la démonstration.

### Ce qu'on modélise et mesure

Les trois pistes Simulink du cadrage correspondent à des blocs du projet :

1. **Mesure de capacité** : charge d'un circuit RC, avec tau = R × C et u(t) = U0 (1 - exp(-t / tau)), comparée pour un doigt loin et un doigt proche.
2. **Filtrage** : un passe-bas, avec le compromis entre bruit et retard, à comparer aux 20 ms. Le filtre du back a une constante réglable, donc le même filtre peut être rejoué hors ligne.
3. **Position vers fréquence** : chaque demi-ton multiplie la fréquence par 2^(1/12). C'est la formule du mode libre.

Le MPR121 fait la mesure de capacité lui-même : pour le dossier, il faut expliquer son principe et modéliser le circuit RC équivalent plutôt que le présenter comme une boîte noire, et choisir une seule grandeur avec une entrée et une sortie claires.

### Simulation principale à faire sous Simulink

Une seule simulation suffit si elle a une entrée, une sortie et des paramètres justifiés : la chaîne « position du doigt vers note jouée », qui relie la précision et la réactivité du cahier des charges.

1. **Entrée** : la position du doigt x(t) le long d'une bande, en rampe pour un glissando et en échelon pour un toucher.
2. **Capteur** : le signal de deux pads voisins en fonction de x (recouvrement du doigt), plus un bruit. Le modèle RC (tau = R × C) explique pourquoi la capacité change quand le doigt approche.
3. **Filtre** : un passe-bas 1 / (tau s + 1) avec tau réglable.
4. **Position estimée** : pos = s2 / (s1 + s2), le rapport des deux pads, comme dans le back.
5. **Note** : f = f0 × 2^(n/12), avec n tiré de pos.

Sorties à relever : le retard total (à comparer aux 20 ms), l'erreur de position en mm et l'erreur de hauteur en cents. Blocs utiles : Ramp, Step, Transfer Fcn, Gain, Sum, Band-Limited White Noise, Scope.

Ordre de grandeur, à ajuster au mapping réel : si une octave (1200 cents) s'étale linéairement sur 40 cm, 1 mm d'erreur vaut 3 cents et un demi-ton fait environ 33 mm. Les valeurs de R, de C et du bruit viennent de la fiche technique du MPR121 ou d'une mesure, jamais d'une valeur inventée.

Deux simulations secondaires restent possibles : un budget de latence (somme des délais de la période d'échantillonnage du MPR121, du filtre, du traitement et du tampon audio) et le circuit RC seul.

### Mesures à faire sur le prototype pour comparer

1. Valeur brute d'un pad en fonction de la position du doigt, avec un repère tous les 5 mm.
2. Bruit au repos, doigt sec puis doigt humide.
3. Délai de bout en bout entre le toucher et le son, avec `/api/metrics` et une mesure externe.
4. Courbes mesurées et simulées superposées, avec les écarts expliqués.

### Conséquences pour le logiciel

- Enregistrer les valeurs brutes de chaque pad avec leur horodatage et les exporter en CSV pour Simulink ou Python.
- Mesurer le délai à chaque étage (lecture capteur, événement, début du son) et l'exposer par l'API.
- Rejouer un enregistrement dans le simulateur pour comparer simulation et réel sur les mêmes données.

## Matériel et surface de jeu

La surface fait 24 zones tactiles capacitives lues par 2 puces MPR121, et le glissement du doigt passe par l'interpolation entre pads voisins.

| Élément | Choix | Statut |
| --- | --- | --- |
| Surface | 4 bandes × 6 sections, 40 cm × 4,5 à 5 cm | Validé |
| Pads | Ruban de cuivre au prototype, plaquettes de laiton ensuite, environ 64 mm × 9 à 10 mm, 2 mm de séparation | Validé |
| Entre les bandes | Bande de masse et petites arrêtes pour guider le doigt | À tester |
| Capteurs tactiles | 2 × MPR121 en I2C (adresses 0x5A et 0x5B), 24 canaux | Validé |
| Glissement | Position continue entre pads par interpolation des valeurs brutes | Semi-validé |
| Potentiomètres | ADS1115 (I2C) ou MCP3008 (SPI) | À choisir |
| Cerveau | Raspberry Pi 4 ou 5 avec carte son USB ou DAC | Validé |
| Dynamique | Capteur de force (FSR) optionnel, sinon valeur de capacité | Option |

### Le point ouvert : glisser sur la surface

Avec des sections de 64 mm, un glissement va d'un pad à l'autre en traversant 2 mm de séparation. Deux modes sont prévus en logiciel :

- **Mode notes** : chaque section joue sa note quantifiée, et glisser enfile les notes (type harpe ou Omnichord).
- **Mode libre** : la position entre deux pads donne un pitch bend continu (type basse fretless).

La largeur de 4,5 à 5 cm pour 4 bandes (11 à 12 mm chacune) est le principal risque : un doigt peut toucher deux bandes. Le logiciel retient la bande au signal le plus fort. Les SoftPots de 500 mm ne rentrent pas dans cette largeur, ils sont donc exclus pour ce format.

## Architecture logicielle

Un back unique isole le matériel, la logique musicale et l'audio, et la page web de test comme le Raspberry Pi utilisent la même API.

&#91;embedded content: architecture du back · 2 sources, 3 blocs, 1 sortie\]

La surface réelle et la page web alimentent le même cœur : le simulateur remplace la surface sans changer une ligne du cœur ni de l'audio.

| Couche | Rôle | Choix proposé (open source) |
| --- | --- | --- |
| Entrées | Lit les MPR121 et l'ADC sur le Pi, ou reçoit les touches du navigateur en mode simulateur, et produit des événements normalisés | Adafruit CircuitPython MPR121 et ADS1x15 (ou smbus2) |
| Cœur | Quantification sur gamme, hystérésis, interpolation, mapping, configuration | Python 3 et FastAPI, Pydantic pour valider la config |
| Audio | Charge les samples en RAM, joue, transpose, filtre, règle le volume | sounddevice et NumPy (ou pygame.mixer), module remplaçable |
| API | REST pour la configuration, WebSocket pour les événements en direct | FastAPI et uvicorn |
| Interface de test | Surface simulée, sliders, éditeur de config, journal d'événements | React, Vite, TypeScript |
| Option | Sortie MIDI vers un synthé | mido et python-rtmidi |

Trois règles tiennent l'ensemble :

1. Le cœur ne connaît pas le matériel : il ne reçoit que des événements normalisés, ce qui rend le simulateur possible.
2. Le même back tourne sur le PC de développement et sur le Raspberry Pi.
3. La latence cible entre le toucher et le son est inférieure à 20 ms. Si elle n'est pas tenue, seul le moteur audio passe en Rust (cpal) sans changer l'API.

## Contrat d'API

Tout passe par des événements JSON normalisés, identiques pour le matériel et pour le simulateur, et par une configuration versionnée.

| Route | Usage |
| --- | --- |
| GET /api/config | Lire la configuration |
| PUT /api/config | Remplacer la configuration (validée, appliquée à chaud) |
| GET /api/state | État courant des 24 zones et des potentiomètres |
| GET /api/calibration | Valeurs brutes par pad pour régler les seuils du MPR121 |
| GET /api/samples | Lister les samples |
| POST /api/samples | Envoyer un sample WAV |
| WS /ws | Flux d'événements du serveur, et envoi d'événements simulés par le client |

Événement de toucher. La position `pos` va de 0 (bas de la bande) à 1 (haut), `section` de 0 à 5, `string` de 0 à 3 :

```json
{"type": "touch", "state": "down", "string": 2, "section": 3, "pos": 0.42, "pressure": 0.7, "source": "hardware", "t": 1763559600.123}
```

Événement de potentiomètre. `value` va de 0 à 1 :

```json
{"type": "pot", "id": "filter", "value": 0.65, "source": "hardware", "t": 1763559600.456}
```

Exemple de configuration. Le schéma exact est laissé à l'implémentation, mais il doit porter un `schema_version` :

```json
{
  "schema_version": 1,
  "layout": {"strings": 4, "sections": 6},
  "strings": [{"id": 0, "base_note": "E1"}, {"id": 1, "base_note": "A1"}, {"id": 2, "base_note": "D2"}, {"id": 3, "base_note": "G2"}],
  "scale": {"root": "E", "mode": "minor_pentatonic_octave"},
  "play_mode": "notes",
  "touch": {"threshold": 12, "release": 6, "hysteresis": 0.05},
  "pots": [{"id": "volume", "channel": 0}, {"id": "filter", "channel": 1}, {"id": "reverb", "channel": 2}, {"id": "bank", "channel": 3}, {"id": "key", "channel": 4}],
  "samples": {"bank": "bass-default"}
}
```

### Mesures pour le dossier OSI

Chaque événement `touch` porte aussi un champ `timing` avec les instants de lecture du capteur, d'émission de l'événement et de début du son.

| Route | Usage |
| --- | --- |
| POST /api/recording/start | Démarrer l'enregistrement des valeurs brutes et des événements |
| POST /api/recording/stop | Arrêter et renvoyer l'identifiant de l'enregistrement |
| GET /api/recording/{id}.csv | Exporter (horodatage, pad, valeur brute, valeur filtrée) |
| POST /api/replay/{id} | Rejouer un enregistrement dans le simulateur |
| GET /api/metrics | Délais mesurés par étage |

## Page web de test et de configuration

Une page web simule la surface et les potentiomètres et sert de console de réglage, en se branchant sur la même API que le Raspberry Pi.

1. **Surface simulée** : une grille 4 × 6 sur laquelle la souris ou le doigt (écran tactile) glisse, en envoyant des événements `touch` avec une position `pos` continue.
2. **Potentiomètres simulés** : 5 sliders (volume, filtre, réverbération, banque de samples, tonalité).
3. **Éditeur de configuration** : nombre de cordes et de sections, gamme et tonalité, notes de base, mode notes ou libre, seuils, samples assignés par section, envoyés par `PUT /api/config`.
4. **Écoute dans le navigateur** : Web Audio pour entendre les samples sans le moteur audio du back, utile avant le Raspberry Pi.
5. **Calibration** : barres en direct des valeurs brutes de chaque pad pour régler les seuils sur le vrai capteur.
6. **Journal d'événements** : flux WebSocket en direct, filtrable par source (`hardware` ou `simulator`).

Quand la vraie surface est branchée, la même grille s'allume avec les touches réelles, ce qui permet de comparer le simulateur et le matériel.

Un onglet **Mesures** pilote l'enregistrement, affiche les délais par étage et télécharge le CSV pour Simulink ou Python.

## Prompt de démarrage pour Antigravity

Le bloc ci-dessous est autonome : il contient le contexte, la stack, le contrat d'API et les phases, à coller tel quel pour lancer le projet.

```markdown
# Projet Omnibasse : prompt de démarrage

Tu es l'ingénieur logiciel principal d'un instrument de musique tactile, l'Omnibasse. Tu construis le back, l'API et une page web de test. Le matériel n'existe pas encore : tout doit fonctionner sans lui.

## Contexte
- Instrument : basse tactile type Omnichord, 4 cordes virtuelles × 6 sections (24 zones tactiles capacitives), environ 40 cm × 4,5 à 5 cm.
- Matériel cible : Raspberry Pi 4 ou 5, 2 × MPR121 en I2C (adresses 0x5A et 0x5B) pour les 24 zones, 5 potentiomètres lus par un ADS1115 (I2C) ou un MCP3008 (SPI).
- Sampler : chaque section joue un sample, quantifié sur une gamme. Deux modes : "notes" (note quantifiée, glisser enchaîne les notes) et "free" (la position pos, interpolée entre pads voisins, donne un pitch bend continu).
- Le projet est aussi un dossier pour les Olympiades de sciences de l'ingénieur 2027 : il faut pouvoir enregistrer des mesures, les exporter et mesurer la latence.

## Stack imposée pour la v1
- Back : Python 3.11 ou plus, FastAPI et uvicorn, Pydantic v2, WebSocket.
- Audio : sounddevice et NumPy, samples WAV chargés en RAM, derrière une interface AudioEngine remplaçable (un moteur Rust avec cpal pourra la remplacer).
- Entrées : une interface InputSource avec deux implémentations. HardwareInput (adafruit-circuitpython-mpr121 et adafruit-circuitpython-ads1x15, ou smbus2) et SimulatorInput (événements reçus par WebSocket depuis la page web).
- Page de test : React, Vite, TypeScript, avec Web Audio pour écouter dans le navigateur.
- Option : sortie MIDI avec mido et python-rtmidi, désactivée par défaut.
- Open source uniquement, licences compatibles MIT. Tu peux ajouter des bibliothèques, mais justifie chacune dans docs/decisions.md.

## Règles d'architecture
1. Le cœur ne connaît pas le matériel : il ne consomme que des événements normalisés.
2. Le même back tourne sur le PC et sur le Raspberry Pi. La source d'entrée se choisit avec la variable OMNIBASSE_INPUT (hardware ou simulator), simulator par défaut.
3. La configuration est un JSON versionné (schema_version), validé par Pydantic et appliqué à chaud, sans redémarrage.
4. Latence cible entre le toucher et le son : moins de 20 ms. Horodate chaque étage (lecture capteur, émission de l'événement, début du son).
5. Tests avec pytest pour la quantification, l'hystérésis, l'interpolation et le filtre, plus des tests d'intégration avec le simulateur.

## Contrat d'API
Routes : GET et PUT /api/config, GET /api/state, GET /api/calibration, GET et POST /api/samples, WS /ws, POST /api/recording/start, POST /api/recording/stop, GET /api/recording/{id}.csv, POST /api/replay/{id}, GET /api/metrics.

Événement touch : type, state (down, move ou up), string (0 à 3), section (0 à 5), pos (0 à 1 le long de la bande), pressure (0 à 1), source (hardware ou simulator), t, timing (t_sensor, t_emit, t_audio).
Événement pot : type, id, value (0 à 1), source, t.
Configuration : schema_version, layout (strings 4, sections 6), strings (notes de base E1, A1, D2, G2), scale (root et mode, par défaut pentatonique mineure plus l'octave, soit 6 notes), play_mode (notes ou free), touch (threshold, release, hysteresis), pots (id et channel : volume, filter, reverb, bank, key), samples (bank).

## Page web de test (livrable de la phase 1)
1. Surface simulée 4 × 6 où la souris ou le doigt glisse et envoie des événements touch avec une position continue.
2. 5 sliders pour les potentiomètres.
3. Éditeur de configuration (cordes, sections, gamme, tonalité, mode, seuils, sample par section) qui fait un PUT /api/config.
4. Écoute dans le navigateur avec Web Audio.
5. Vue de calibration : valeurs brutes de chaque pad en direct.
6. Journal d'événements en direct, filtrable par source.
7. Onglet Mesures : enregistrer, rejouer, voir les délais par étage, télécharger le CSV.

## Phases
1. Back, simulateur et page web, sans matériel, avec des samples de test générés (sinus ou basse synthétique).
2. Moteur sampler, quantification, modes notes et free.
3. Enregistrement, rejeu, métriques et export CSV.
4. HardwareInput sur le Raspberry Pi (MPR121, ADS1115), calibration, démarrage automatique avec systemd.

Commence par la phase 1. À la fin de chaque phase : tests verts, README à jour avec la commande de lancement, et un court résumé des choix.

## Consignes
- Structure du dépôt : backend, frontend, docs, samples, README.
- N'invente pas de matériel : si une décision manque, prends la plus simple et note-la dans docs/decisions.md.
- Ne me pose de question que sur la tonalité par défaut, les samples, ou tout ce qui coûte de l'argent.
```

## Étapes suivantes et questions ouvertes

La suite immédiate est de lancer Antigravity sur la phase 1 pendant qu'on tranche les points de conception et les points OSI.

- [ ] Coller le prompt dans Antigravity et lancer la phase 1 (back, simulateur, page web)
- [ ] Prototyper la surface en ruban de cuivre pour tester la largeur de 4,5 à 5 cm avant de figer les dimensions
- [ ] Lire la notice et la grille d'évaluation sur la page OSI du site UPSTI
- [ ] Demander à l'enseignant l'inscription sur Adage (avant le 13 mars 2027) et la date de la finale académique
- [ ] Fixer le cahier des charges chiffré : nombre d'essais et tolérance de position

Questions ouvertes :

- Mode notes ou mode libre comme mode principal pour la démonstration ?
- Gamme et tonalité par défaut (pentatonique mineure plus l'octave est proposée).
- Source des samples : basse enregistrée ou son synthétique ?
- Python et FastAPI pour la v1, avec Rust seulement si la latence dépasse 20 ms : d'accord ?
