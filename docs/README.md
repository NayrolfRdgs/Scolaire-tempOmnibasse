# Documentation — Scolaire-tempOmnibasse

Le README à la racine est volontairement court : tout le détail est ici.

## technique/ — installer et utiliser

| Document | Objet |
| --- | --- |
| [guide_technique.md](technique/guide_technique.md) | Installation Windows/Pi, architecture, API REST et WebSocket, câblage MPR121/ADC, interface web, dépannage |

## projet/ — dossier OSI 2027

| Document | Objet | Statut |
| --- | --- | --- |
| [cahier_des_charges.md](projet/cahier_des_charges.md) | Besoin, exigences chiffrées, contraintes, plan d'essais, points ouverts | À valider avec l'enseignant |
| [simulations.md](projet/simulations.md) | Guide Simulink et alternative Python pour les 4 simulations | Valeurs `PROVISOIRE` à remplacer |
| [protocole_mesures.md](projet/protocole_mesures.md) | Protocoles P1 à P6 pour relever les grandeurs | À exécuter sur le prototype |
| [decisions.md](projet/decisions.md) | Justification des bibliothèques et des choix d'architecture | À compléter au fil des ajouts |
| [manquant_logiciel.md](projet/manquant_logiciel.md) | Écarts détaillés entre le cadrage et le code | Suivi |
| [repartition_taches.md](projet/repartition_taches.md) | Les 4 personnes, les tâches et le calendrier jeudi/vendredi | Suivi |

`modelisation_3d/` contient l'archive du modèle CAO (`highres.glb`, `textured.glb`).

## Sources utilisées

- `Omnibasse — doc projet et prompt de démarrage Antigravity.md` (vision, cadrage OSI, contrat d'API, phases)
- `backend/`, `frontend/` et leurs fichiers de configuration

## Règle de mise à jour

Toute valeur numérique ajoutée doit indiquer sa **source** : code, fiche technique ou mesure. Les valeurs marquées `PROVISOIRE`, `À mesurer` ou `À fixer` ne doivent pas être présentées comme des résultats dans le dossier OSI.
