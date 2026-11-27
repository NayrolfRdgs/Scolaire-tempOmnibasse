# Documentation Omnibasse

Ce dossier regroupe les documents de cadrage, de simulation, de mesure et de suivi du projet.

| Document | Objet | Statut |
| --- | --- | --- |
| [cahier_des_charges.md](cahier_des_charges.md) | Besoin, exigences chiffrées, contraintes, plan d'essais, points ouverts | À valider avec l'enseignant |
| [simulations.md](simulations.md) | Guide pas à pas Simulink + alternative Python pour les 4 simulations | Opérationnel (valeurs `PROVISOIRE` à remplacer) |
| [protocole_mesures.md](protocole_mesures.md) | Protocoles P1 à P6 pour relever les grandeurs du cahier des charges | À exécuter sur le prototype |
| [decisions.md](decisions.md) | Justification des bibliothèques et des choix d'architecture | À compléter au fil des ajouts |
| [manquant_logiciel.md](manquant_logiciel.md) | Écart détaillé entre le doc source / le cahier des charges et le code actuel, avec plan de travail | Suivi |

## Sources utilisées

- `Omnibasse — doc projet et prompt de démarrage Antigravity.md` (vision, cadrage OSI, contrat d'API, phases)
- `README.md` (architecture, API, câblage, dépannage)
- `backend/main.py`, `backend/config.py`, `backend/touch_engine.py`, `backend/audio_engine.py`, `backend/hardware/mpr121.py`, `backend/hardware/mock.py`
- `frontend/src/App.tsx` et `frontend/src/components/`

## Règle de mise à jour

Toute valeur numérique ajoutée doit indiquer sa **source** : code, fiche technique ou mesure. Les valeurs marquées `PROVISOIRE`, `À mesurer` ou `À fixer` ne doivent pas être présentées comme des résultats dans le dossier OSI.
