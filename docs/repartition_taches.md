# Répartition des tâches et calendrier

Version 0.1 — 27 novembre 2026  
Projet : **Scolaire-tempOmnibasse** (Omnibasse, OSI 2027).

---

## 1. Comment cette répartition a été reconstituée

L'historique Git ne permet pas de séparer les auteurs : les trois premiers commits ont été créés lors de la mise en ligne du dépôt, tous sous le même compte. L'attribution ci-dessous s'appuie donc sur :

- les **dates de modification des fichiers** (horodatages Windows) ;
- le **contenu** des fichiers (ce qui existait avant mon intervention) ;
- le doc source `Omnibasse — doc projet et prompt de démarrage Antigravity.md`.

À corriger manuellement si une attribution est inexacte.

### Historique reconstitué

| Date | Ce qui est apparu | Attribution probable | Preuve |
| --- | --- | --- | --- |
| **19 nov. 2026, 14:40–14:49** | Noyau backend : `config.py`, `scales.py`, `touch_engine.py`, `audio_engine.py`, `main.py`, `ws_manager.py` | **Toi** | Horodatages des fichiers |
| **19 nov. 2026, 14:40–14:45** | Noyau frontend : `package.json`, `vite.config.ts`, `App.tsx`, `api.ts`, `types.ts`, composants | **Toi** | Horodatages des fichiers |
| **19 nov. 2026, 14:42–14:54** | Scripts Windows, `.gitignore`, `.env.example`, service systemd, script Pi, premières banques WAV `bass-default` | **Toi** | Horodatages des fichiers |
| **19 nov. 2026, 16:44–16:49** | Banques de samples étendues (rhodes, fretless, omnichord, sub-808…) et `audioSynthesizer.ts`, `PotSliders.tsx` | **Toi** | Horodatages des fichiers |
| **27 nov. 2026, 10:02** | Modèles 3D `highres.glb` et `textured.glb` | **Toi** | Horodatages des fichiers |
| **27 nov. 2026, 10:37** | Doc source avec vision, cadrage OSI, contrat d'API et prompt Antigravity | **Toi** | Horodatage du fichier |
| **27 nov. 2026, 10:52** | `simulations/sim_position_note.py`, `simulations/releve_calibration.py` | Moi (assistant) | Création lors de notre échange |
| **27 nov. 2026, 11:05** | `docs/cahier_des_charges.md`, `simulations.md`, `protocole_mesures.md`, `decisions.md`, `manquant_logiciel.md` et archive ZIP 3D | Moi pour les `.md` ; ZIP ajouté par toi | Horodatages + contenu |
| **27 nov. 2026, 11:08–11:15** | Dépôt GitHub privé, renommage, README réparti dans `docs/` | Moi (assistant) | Commits Git |

### Ce que tu as déjà fait (bilan)

- Backend complet : API, boucle 100 Hz, gammes, quantification, barycentre, arbitrage de corde, audio polyphonique.
- Frontend complet pour l'essentiel : grille 4×6, sliders, calibration, journal filtrable, éditeur de config.
- Banques de samples nombreuses côté navigateur, synthétiseur audio, modèles 3D.
- Documentation source et cadrage OSI.
- Mise en ligne du dépôt privé.

### Ce que l'équipe devra faire

Tout ce qui est listé dans [manquant_logiciel.md](manquant_logiciel.md), en particulier les écarts **P0** (mesures, latence, filtre) et la validation matérielle.

---

## 2. Répartition par rôle

> L'équipe compte **2 à 5 lycéens**. Les rôles ci-dessous peuvent être fusionnés : voir le tableau de dimensionnement plus bas.

| Rôle | Responsable | Missions principales | Numéros de tâches | Ce qu'il ne fait pas |
| --- | --- | --- | --- | --- |
| **Chef de projet / intégration** | **Toi** | Arbitrage des choix, revue des commits, intégration back↔front↔mesures, contact enseignant, soutenance | O1–O7, suivi global | Ne réécris pas seul les modules des autres |
| **Développeur back / mesures** | Dev 1 | Instrumentation, enregistrement, métriques, filtre capacitif, hystérésis, tests, config | M-01, M-02, M-03, M-04, M-08, M-10, M-13, M-14 | UI et matériel |
| **Développeur frontend** | Dev 2 | Onglet Mesures, branchement Web Audio, ergonomie, tests navigateur | M-05, M-06, interface_web.md | Logique de mesure côté serveur |
| **Électronique / prototype** | Dev 3 | Ruban de cuivre, MPR121, ADC des pots, câblage, essais doigt sec/humide | M-11, P1–P3, hardware.md | Documentation rédactionnelle |
| **Scientifique / dossier OSI** | Dev 4 | Calage des simulations, mesures P4–P6, courbes comparées, grille UPSTI, rédaction | cahier_des_charges.md, simulations.md, protocole_mesures.md, docs/mesures/ | Code applicatif |
| **Enseignant** | Encadrant | Inscription Adage, accès notice/grille UPSTI, validation des critères, suivi finale | O5, O6, calendrier académique | Développement |

### Dimensionnement selon l'effectif

| Effectif | Répartition conseillée |
| --- | --- |
| **2 lycéens** | Toi = chef de projet + back/mesures ; Dev 1 = front + matériel + dossier (alterner les semaines) |
| **3 lycéens** | Toi = intégration + back ; Dev 1 = front ; Dev 2 = matériel + dossier |
| **4 lycéens** | Rôles du tableau ci-dessus, avec toi sur l'intégration |
| **5 lycéens** | Ajouter un « documentation / soutenance » distinct du scientifique |

---

## 3. Calendrier

Les dates de vacances sont **à confirmer** avec le calendrier académique. Le point de départ est le **19 novembre 2026** (premiers fichiers), aujourd'hui est le **27 novembre 2026**.

| Période | Objectif | Tâches | Responsable | Livrable / jalon |
| --- | --- | --- | --- | --- |
| **19 → 27 nov. 2026** *(déjà fait)* | Socle logiciel + cadrage | Back, front, samples, 3D, doc source, dépôt privé, docs initiales | **Toi** + assistant | Dépôt GitHub en ligne, `docs/` complet |
| **30 nov. → 11 déc. 2026** | Phase A — rendre le projet mesurable | M-01, M-02, M-03, M-04, M-14 + lecture grille UPSTI | Dev 1 + enseignant | `/api/metrics`, CSV, `timing`, filtre `tau`, hystérésis active |
| **14 → 25 déc. 2026** | Phase B — démonstration complète | M-05, M-06, M-07, M-10 | Dev 2 | Onglet Mesures, Web Audio actif, samples back chargés |
| **Vacances de Noël** *(à confirmer)* | Pause / rattrapage | — | — | — |
| **4 → 29 janv. 2027** | Phase C — qualité et premier banc | M-08, M-12, M-13 + prototype cuivre + P1, P2, P3 | Dev 3 + Dev 4 | Tests verts, surface prototype, `sigma`, `bruit_std`, `tau` mesurés |
| **1 → 26 fév. 2027** | Essais complets | P4, P5, P6 + calage des simulations | Dev 4 + Dev 1 | Courbes simulées/mesurées superposées, budget latence chiffré |
| **1 → 13 mars 2027** | Gel du dossier | O5, Adage par l'enseignant, validation des critères | Enseignant + Toi | Cahier des charges figé, **inscription Adage avant le 13 mars** |
| **15 mars → 30 avr. 2027** | Rédaction et schémas | Fiches techniques, schémas, captures, répétitions | Dev 4 + Toi | Dossier OSI v1 complet |
| **1 → fin mai 2027** | Finale nationale | Ajustements, soutenance | Toute l'équipe | Présentation + dossier final |

### Jalons

| Jalon | Date cible | Critère de réussite |
| --- | --- | --- |
| J1 — Socle en ligne | 27 nov. 2026 | Repo privé, README et `docs/` cohérents |
| J2 — Chaîne de mesure | 11 déc. 2026 | Start/stop CSV + `timing` + `tau` configurable |
| J3 — Démo navigateur | 25 déc. 2026 | Onglet Mesures + son Web Audio + samples |
| J4 — Prototype et tests | 29 janv. 2027 | Tests pytest verts, 3 grandeurs mesurées |
| J5 — Essais comparés | 26 fév. 2027 | P4/P5/P6 archivés dans `docs/mesures/` |
| J6 — Cahier figé | 13 mars 2027 | Adage fait, critères validés par l'enseignant |
| J7 — Dossier complet | 30 avr. 2027 | Toutes les exigences tracées |
| J8 — Finale | Fin mai 2027 | Soutenance |

---

## 4. Charge estimée

| Rôle | Charge hebdomadaire | Période principale | Total approximatif |
| --- | --- | --- | --- |
| Toi (intégration) | 4–6 h | Tout le projet | ~100 h |
| Dev 1 (back/mesures) | 6–8 h | Déc. – fév. | ~70 h |
| Dev 2 (front) | 4–6 h | Déc. – janv. | ~35 h |
| Dev 3 (matériel) | 6–8 h | Janv. – fév. | ~55 h |
| Dev 4 (dossier/OSI) | 5–7 h | Janv. – avr. | ~80 h |

Ces estimations sont indicatives et à réévaluer après la première semaine de phase A.

---

## 5. Règles de fonctionnement

1. **Une tâche = un ticket** dans [manquant_logiciel.md](manquant_logiciel.md) ou dans un tableau de bord partagé. Référence toujours l'ID (`M-01`, `P4`, `O5`…).
2. **Une branche par tâche** : `feature/M-01-recording`, `feature/M-05-mesures-ui`, etc. Fusion dans `main` après revue.
3. **Définition de done** : code + test ou mesure + documentation mise à jour + commit poussé.
4. **Traçabilité** : toute valeur numérique marque sa source (code / fiche / mesure). Voir [docs/README.md](README.md).
5. **Point hebdomadaire** : 15 min, chaque lundi : avancement, bloquants, décisions à trancher.
6. **Ne pas inventer** : si une donnée manque (R, C, seuil, tolérance), la noter `À mesurer` et demander à l'enseignant.

---

## 6. Dépendances et risques

| Dépendance | Bloque | Owner |
| --- | --- | --- |
| Grille UPSTI / notice | Gel du cahier des charges (O5) | Enseignant |
| Module ADC choisi (O6) | M-11 et commande matérielle | Toi + enseignant |
| Routes d'enregistrement (M-01) | Toutes les mesures P1–P6 | Dev 1 |
| Valeur de `tau` (P3) | Simulations et budget latence | Dev 3 + Dev 4 |
| Décision mode notes / libre (O1) | Contenu de la démonstration | Toi + enseignant |
| Bloc audio 512 → 256 | Conformité EX-01 (< 20 ms) | Dev 1 après P4 |

---

## 7. À mettre à jour

- [ ] Corriger les attributions si un fichier a été écrit par quelqu'un d'autre.
- [ ] Remplacer les dates de vacances par celles de l'académie.
- [ ] Répartir les rôles selon l'effectif réel de l'équipe.
- [ ] Créer les tickets GitHub / tableau de bord à partir des IDs M-xx, P-x, O-x.
