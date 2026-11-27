# Protocole de mesures sur le prototype

Objectif : produire les valeurs manquantes du [cahier des charges](cahier_des_charges.md#52-à-relever-avant-rédaction-du-dossier) et alimenter les simulations de [simulations.md](simulations.md).

---

## Matériel et préparation

- Ruban de cuivre ou plaquettes sur une bande de 6 pads de 64 mm, séparation 2 mm.
- Règle ou repères imprimés tous les **5 mm** le long de la bande.
- Raspberry Pi + 2 MPR121 (0x5A, 0x5B), carte son USB ou DAC.
- PC avec le back et le frontend lancés (`start_dev.bat`, `start_frontend.bat`).
- Python avec `requests` pour le script de relevé.
- Facultatif : oscilloscope ou micro + Audacity pour la mesure acoustique de latence.

Avant chaque série : `GET /api/calibration` doit répondre et afficher des deltas proches de 0 au repos. Si la baseline dérive, attendre la stabilisation ou ajuster les registres du MPR121.

Script de relevé utilisé : `simulations/releve_calibration.py` → `pad_mesures.csv` avec colonnes `t, pad, valeur`.

---

## P1 — Capacité en fonction de la position

1. Coller les repères 0, 5, 10 … 320 mm sur la bande.
2. Lancer `python simulations\releve_calibration.py` depuis la racine.
3. Pendant 6 secondes, poser le doigt successivement sur chaque repère, environ 0,3 s par repère, sans glisser.
4. Ouvrir `pad_mesures.csv` dans un tableur ou tracer avec Python.
5. Pour chaque position, relever le delta maximal des 6 pads de la corde.
6. Ajuster le modèle gaussien : `sigma` est l'écart-type qui donne la même largeur de courbe que la mesure.
7. Conserver la courbe mesurée et la courbe simulée sur le même graphique.

Résultat attendu : une courbe par pad, maximal au centre du pad, recouvrement avec les pads voisins.

---

## P2 — Bruit sec / humide

1. Aucun doigt sur la surface : enregistrer 3 s via le script de relevé.
2. Calculer l'écart-type des valeurs d'un pad au repos : `bruit_std_sec`.
3. Mouiller légèrement le doigt (ou utiliser une lingette humide), sans toucher : refaire 3 s → `bruit_std_humide`.
4. Toucher légèrement et enregistrer le plateau → comparer les plateaux secs et humides.

| Condition | Pad | Écart-type | Plateau moyen | À comparer avec EX-04 |
| --- | --- | --- | --- | --- |
| Sec | … | … | … | … |
| Humide | … | … | … | … |

---

## P3 — Mesure de `tau`

1. Configurer le MPR121 avec les registres actuels de `hardware/mpr121.py` : `CONFIG1 = 0x10` (CDT = 16 µs), `CONFIG2 = 0x20` (ESI = 1 ms), `MHDF = 0x05`, `NCLF = 0x01`.
2. Relever la documentation du constructeur : relever les temps de réponse correspondant à ces réglages et les noter ici. **Ne pas inventer de valeur.**
3. Mesure complémentaire : faire un toucher échelon (poser le doigt d'un coup) et enregistrer le delta du pad.
4. Sur la courbe, trouver l'instant où le delta atteint **63,2 %** de sa valeur finale. Cet instant donne `tau`.
5. Vérifier que `tau = R × C` est cohérent avec la simulation [§ 5 de simulations.md](simulations.md#5-simulation-2--le-circuit-rc-seul).

| Origine | `tau` (ms) | Commentaire |
| --- | --- | --- |
| Fiche MPR121 | … | Relevé de la table des filtres |
| Mesure 63,2 % | … | Moyenne sur 10 échelons |

---

## P4 — Latence

### Avec le backend terminé (routes M-01 / M-02 implémentées)

1. `POST /api/recording/start`.
2. Réaliser 20 touchers sur des sections différentes.
3. `POST /api/recording/stop` puis `GET /api/metrics`.
4. Relever pour chaque événement : `t_sensor`, `t_emit`, `t_audio`.
5. Calculer `t_audio − t_sensor` et vérifier EX-01 (< 20 ms).

### En attendant (mesure externe)

1. Enregistrer le son avec un micro placé près de la surface, en vidéo ou avec Audacity.
2. Le premier échantillon audio non nul donne l'instant du son.
3. L'instant du toucher est repéré par un changement visible sur `GET /api/calibration` ou par un contact électrique auxiliaire.
4. Écart = latence acoustique. Attention : le trajet micro et la carte son ajoutent leur propre délai, à soustraire ou à signaler.

### Budget théorique à confirmer

| Étage | Valeur | Source |
| --- | --- | --- |
| Lecture capteur / boucle | 10,00 ms | `main.py` (100 Hz) |
| Tampon audio | 11,61 ms | `audio_engine.py` (512 / 44100) |
| Filtre capacitif `tau` | À mesurer | P3 |
| Traitement back | À mesurer | `/api/metrics` |
| **Total** | **≥ 21,61 ms avant filtre et traitement** | Constat : EX-01 risquée |

---

## P5 — Distinction des zones

1. Choisir un nombre d'essais `N` (proposition : 200, 50 par corde) et le valider avec l'enseignant.
2. Demander à une personne de toucher une section annoncée au hasard, sans voir l'écran.
3. Noter la section réellement émise dans le journal WebSocket (`source: hardware`).
4. Compter les erreurs : section voisine, corde voisine, absence d'événement, double événement.
5. Résultat : taux d'erreur, doit être nul selon EX-02.

---

## P6 — Précision de position

1. Passer en `play_mode = "free"` via `PUT /api/config` ou l'éditeur de configuration.
2. Poser le doigt sur un repère connu `x_réel` (tous les 5 mm).
3. Lire `pos` dans `GET /api/state` ou dans le journal WebSocket.
4. Calculer `x_estimé = pos × 320` et `erreur = |x_estimé − x_réel|` en mm.
5. Refaire sur 10 positions réparties sur la bande, puis pour les 4 cordes.
6. Comparer avec la tolérance EX-03 et avec l'erreur simulée du [§ 4 de simulations.md](simulations.md#4-simulation-principale--position-du-doigt--note-jouée).

---

## Format d'archivage

Créer un dossier `docs/mesures/` avec un fichier par essai :

```text
docs/mesures/
├── p1_capacite_position.csv
├── p2_bruit_sec.csv
├── p2_bruit_humide.csv
├── p3_tau.csv
├── p4_latence.csv
├── p5_distinction_zones.csv
└── p6_precision_position.csv
```

Colonnes minimales pour un enregistrement complet conforme au doc source :

```csv
t,pad,brut,filtre,evenement,source
0.001234,3,18,12,down,hardware
```

Chaque fichier doit être accompagné d'une courbe et d'une phrase d'interprétation dans le dossier OSI.
