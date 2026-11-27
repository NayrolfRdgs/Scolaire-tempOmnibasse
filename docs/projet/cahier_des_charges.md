# Cahier des charges — Omnibasse

Version 0.2 — 27 novembre 2026  
Statut : **proposition à valider** avec l'enseignant et à confronter à la notice UPSTI.

---

## 1. Contexte

L'Omnibasse est un instrument tactile joué au doigt, entre une basse et un Omnichord, qui pilote un sampler tournant sur Raspberry Pi. Le projet sert aussi de dossier pour les Olympiades de sciences de l'ingénieur 2027, thème « L'ingénierie au service de l'art ».

| Repère | Date / information | Source |
| --- | --- | --- |
| Inscriptions Adage | 2 novembre 2026 → 13 mars 2027, par l'enseignant | Doc source |
| Finale nationale | Fin mai 2027 | Doc source |
| Équipe | 2 à 5 lycéens, 1 ou 2 enseignants | Doc source |
| Grille d'évaluation terminale | **Dans la notice UPSTI, pas encore lue** | Point ouvert bloquant |

**Conséquence** : les critères ci-dessous sont chiffrés de manière cohérente avec le doc source et le code, mais ils doivent être recalés sur la grille UPSTI avant d'être figés.

---

## 2. Besoin exprimé

| Besoin | Description |
| --- | --- |
| Jouer sans connaissance musicale | Chaque zone déclenche une note quantifiée sur une gamme : « on ne joue pas faux ». |
| Jouer en continu | Le doigt glisse le long d'une bande ; la position interpolée produit un pitch-bend. |
| Régler en direct | 5 potentiomètres : volume, filtre, réverbération, banque de samples, tonalité. |
| Développer sans matériel | Une page web simule la surface et envoie les mêmes événements que le Raspberry Pi. |
| Justifier scientifiquement | Une simulation Simulink et des mesures sur prototype doivent alimenter le dossier OSI. |

---

## 3. Fonctions principales

| ID | Fonction | Entrée | Sortie | Priorité |
| --- | --- | --- | --- | --- |
| F1 | Lire la surface capacitive | 24 deltas MPR121 | Valeurs brutes horodatées | A |
| F2 | Détecter un toucher | Valeurs brutes, seuil 12 / release 6 | Événements `down` / `move` / `up` | A |
| F3 | Estimer la position | 6 valeurs d'une corde | `pos` ∈ [0 ; 1] par barycentre | A |
| F4 | Choisir la corde dominante | 4 cordes actives | Une seule corde retenue | A |
| F5 | Quantifier sur gamme | `section`, gamme, tonalité | Note, fréquence cible | A |
| F6 | Jouer le sample | Note + position + pression | Audio via `sounddevice` | A |
| F7 | Simuler la surface (web) | Souris / doigt sur grille 4×6 | Événements WebSocket `source: simulator` | A |
| F8 | Enregistrer et rejouer | Flux capteur + événements | CSV + rejeu dans le simulateur | A (OSI) |
| F9 | Mesurer la latence | Horodatages par étage | Délais par étage, total | A (OSI) |
| F10 | Configurer à chaud | JSON versionné `schema_version` | Nouvelle config appliquée sans redémarrage | B |
| F11 | Calibrer | Valeurs brutes en direct | Seuils ajustés | B |
| F12 | Sortie MIDI optionnelle | Événements | MIDI vers synthé | C |

---

## 4. Exigences chiffrées

> Légende : **Validé** = déjà conforme dans le code ; **À mesurer** = valeur à relever ; **À fixer** = décision à prendre.

| ID | Exigence | Critère chiffré | Vérification | État |
| --- | --- | --- | --- | --- |
| **EX-01** | Réactivité | Délai toucher → son **< 20 ms** bout en bout | Horodatages `t_sensor`, `t_emit`, `t_audio` + mesure externe (micro / oscilloscope) | **À mesurer** — risque fort (voir § 7) |
| **EX-02** | Distinction des zones | **0 erreur** sur un nombre d'essais à fixer. Proposition : **200 touchers**, 50 par corde, répartis sur les 6 sections | Mode notes + journal d'événements : la section annoncée doit être celle attendue | Nombre d'essais **à fixer** |
| **EX-03** | Précision de position | Écart entre repère réel et `pos × 320 mm`. Proposition : **≤ 5 mm** (un repère de mesure) | Mode libre, repères tous les 5 mm, comparaison `pos` calculé / position réelle | Tolérance **à fixer** |
| **EX-04** | Robustesse | Doigt sec vs doigt humide : écart relatif du delta à spécifier. Proposition : **≤ 20 %** sur la valeur plateau | Enregistrement des valeurs brutes dans les deux conditions | Seuil **à fixer** |
| **EX-05** | Plage jouable | **24 notes** = 4 cordes × 6 sections, quantifiées sur la gamme configurée | `GET /api/config` + journal des notes déclenchées | **Validé** code (`scales.py`) |
| **EX-06** | Glissement continu | Aucun saut de `pos` supérieur à `hysteresis = 0,05` entre deux trames tant que le doigt reste sur la corde | Enregistrement `pos(t)` en mode libre | **Partiel** : méthode présente mais non appelée (voir `manquant_logiciel.md`, M-04) |
| **EX-07** | Arbitrage de corde | Aucune note émise sur une corde voisine quand deux cordes sont touchées | Journal d'événements, essai avec deux doigts | **Validé** code (`touch_engine.py`) |
| **EX-08** | Audio | 4 voix polyphoniques, 44 100 Hz, tampon 512 échantillons (**11,61 ms**) | `audio_engine.py`, mesure de latence | **Validé** code, contribue à EX-01 |
| **EX-09** | Configuration à chaud | `PUT /api/config` appliqué sans redémarrage, avec `schema_version = 1` | Test API / éditeur de config | **Validé** code |
| **EX-10** | Indépendance au matériel | Le même back tourne avec `MockHardware` et avec le simulateur web | Lancement Windows sans Pi | **Validé** code |
| **EX-11** | Traçabilité des mesures | Export CSV `(horodatage, pad, valeur brute, valeur filtrée)` et rejeu | Routes d'enregistrement | **Manquant** (voir M-01) |
| **EX-12** | Documentation des choix | Chaque bibliothèque justifiée | `docs/decisions.md` | **Fait** |

### Remarque sur le critère « distinguer chaque demi-ton »

Le doc source indique que ce critère d'exemple ne s'applique pas tel quel avec 6 sections de 64 mm. Deux réponses possibles :

1. **Adapter et justifier** : avec une octave sur 320 mm, un demi-ton vaut 26,7 mm, largement supérieur aux 64 mm d'un pad → la quantification sur gamme, pas le demi-ton, est la grandeur pertinente.
2. **Ajouter un mode chromatique 12 pads** pour la démonstration (`scale.mode = chromatic` existe déjà dans `scales.py`) et mesurer alors la distinction des demi-tons.

---

## 5. Paramètres numériques

### 5.1 Figés par le code ou la géométrie

| Paramètre | Valeur | Source |
| --- | --- | --- |
| Surface | 4 cordes × 6 sections, ~400 mm × 45–50 mm | Doc source |
| Pas des pads | 64 mm, séparation 2 mm | Doc source |
| Centres des pads | 0, 64, 128, 192, 256, 320 mm | Calcul sur 6 sections |
| Canaux MPR121 | 2 puces, adresses `0x5A` / `0x5B`, 24 canaux | `hardware/mpr121.py` |
| Seuil / release | 12 / 6 (delta capacitif) | `config.py` |
| Hystérésis position | 0,05 | `config.py` |
| Gamme par défaut | Pentatonique mineure + octave `[0 3 5 7 10 12]` | `scales.py` |
| Notes de base | E1 (41,203 Hz), A1, D2, G2 | `config.py`, `scales.py` |
| Fréquence d'échantillonnage audio | 44 100 Hz | `audio_engine.py` |
| Bloc audio | 512 échantillons → 11,61 ms | `audio_engine.py` |
| Boucle de lecture capteur | 100 Hz → 10 ms | `main.py` |
| Polyphonie | 4 voix | `audio_engine.py` |
| Plage filtre audio | 200 Hz à 8 kHz (Butterworth ordre 2) | `audio_engine.py` |

### 5.2 À relever avant rédaction du dossier

| Paramètre | Utilité | Méthode |
| --- | --- | --- |
| `tau` du filtre capacitif | Simulation RC et budget latence | Fiche MPR121 ou réponse à échelon 63,2 % (protocole P3) |
| `sigma` du recouvrement | Modèle gaussien du doigt | Protocole P1 |
| `bruit_std` sec / humide | Modèle de bruit et robustesse EX-04 | Protocole P2 |
| `t_traitement` | Budget latence | `/api/metrics` une fois implémenté |
| Nombre d'essais EX-02 | Validité statistique | Décision enseignant |
| Tolérance EX-03 | Conformité position | Décision enseignant |

---

## 6. Plan d'essais

| Essai | Objectif | Protocole | Donnée produite |
| --- | --- | --- | --- |
| P1 | Delta d'un pad vs position | [protocole_mesures.md](protocole_mesures.md#p1--capacité-en-fonction-de-la-position) | Courbe + `sigma` |
| P2 | Bruit au repos sec / humide | [P2](protocole_mesures.md#p2--bruit-sec--humide) | Écarts-type |
| P3 | Constante de temps RC | [P3](protocole_mesures.md#p3--mesure-de-tau) | `tau` en ms |
| P4 | Latence bout en bout | [P4](protocole_mesures.md#p4--latence) | Délai total + par étage |
| P5 | Distinction des zones | [P5](protocole_mesures.md#p5--distinction-des-zones) | Taux d'erreur |
| P6 | Précision de position | [P6](protocole_mesures.md#p6--précision-de-position) | Erreur en mm |

Chaque essai doit produire un fichier CSV archivé dans `docs/mesures/` et une courbe comparée à la simulation correspondante de [simulations.md](simulations.md).

---

## 7. Analyse de risques

| Risque | Impact | Élément chiffré concerné | Mitigation |
| --- | --- | --- | --- |
| Largeur 45–50 mm pour 4 bandes : un doigt touche deux cordes | Notes parasites | EX-07 | Arbitrage corde dominante déjà implémenté ; à valider au prototype |
| Latence : 10 ms capteur + 11,61 ms tampon = 21,61 ms avant filtre et calcul | Échec EX-01 | EX-01 | Réduire bloc audio à 256, réduire ESI du MPR121, ou moteur audio Rust |
| Filtre simulé absent du back | Simulation non représentative | EX-01, EX-03 | Ajouter le filtre `tau` dans le traitement (M-03) |
| Valeurs `PROVISOIRE` laissées dans les modèles | Dossier non scientifique | Tous | Remplacement obligatoire par mesures (§ 5.2) |
| Grille UPSTI non lue | Critères hors sujet | Tous | Lecture avant gel du cahier des charges |
| Samples absents | Démonstration silencieuse | F6 | Générer `0.wav`–`5.wav` (M-07) |

---

## 8. Points ouverts et décisions à prendre

| # | Question | Décision attendue de | Échéance |
| --- | --- | --- | --- |
| O1 | Mode notes ou mode libre pour la démonstration ? | Équipe + enseignant | Avant prototype |
| O2 | Tonalité et gamme par défaut (pentatonique mineure + octave proposée) | Équipe | Avant gel config |
| O3 | Samples : basse enregistrée ou synthétique ? | Équipe (coût / temps) | Avant phase audio |
| O4 | Python/FastAPI v1, Rust seulement si > 20 ms ? | Enseignant | Après mesure P4 |
| O5 | Nombre d'essais EX-02 et tolérance EX-03 | Enseignant / notice UPSTI | Avant rédaction |
| O6 | ADS1115 ou MCP3008 pour les potentiomètres ? | Équipe (coût) | Avant commande |
| O7 | Capteur de force FSR optionnel ? | Équipe (coût) | Avant commande |

---

## 9. Traçabilité exigence → simulation → mesure

| Exigence | Simulation | Mesure |
| --- | --- | --- |
| EX-01 Réactivité | `simulations.md` § 4 et § 7 (budget) | P4 |
| EX-02 Distinction zones | — | P5 |
| EX-03 Précision position | `simulations.md` § 4 (erreur mm) | P6 |
| EX-04 Robustesse | `simulations.md` § 4 (bruit) | P2 |
| EX-05 Plage 24 notes | `simulations.md` § 6 | Journal WebSocket |
| EX-06 Glissement | `simulations.md` § 4 (rampe) | P6 |
| EX-07 Arbitrage corde | — | P5 (deux doigts) |
| EX-08 Audio | `simulations.md` § 7 | P4 |
