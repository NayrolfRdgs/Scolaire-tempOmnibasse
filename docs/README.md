# Documentation — Scolaire-tempOmnibasse

Bienvenue dans le dossier de documentation. Le README à la racine est volontairement court : il sert de point d'entrée, tout le détail est ici.

## Prise en main

| Document | Objet |
| --- | --- |
| [installation.md](installation.md) | Prérequis, lancement Windows, installation Raspberry Pi, service systemd |
| [architecture.md](architecture.md) | Schéma d'ensemble, couches, règles, structure du dépôt |
| [api.md](api.md) | Routes REST, événements WebSocket, configuration JSON, gammes |
| [hardware.md](hardware.md) | Câblage MPR121/ADC, mapping des canaux, calibration |
| [interface_web.md](interface_web.md) | Onglets de la page de test et fonctionnalités prévues |
| [depannage.md](depannage.md) | Problèmes courants et vérifications |
| [repartition_taches.md](repartition_taches.md) | Historique, rôles, calendrier et charge de travail |

## Projet OSI 2027

| Document | Objet | Statut |
| --- | --- | --- |
| [cahier_des_charges.md](cahier_des_charges.md) | Besoin, exigences chiffrées, contraintes, plan d'essais, points ouverts | À valider avec l'enseignant |
| [simulations.md](simulations.md) | Guide pas à pas Simulink + alternative Python pour les 4 simulations | Opérationnel (valeurs `PROVISOIRE` à remplacer) |
| [protocole_mesures.md](protocole_mesures.md) | Protocoles P1 à P6 pour relever les grandeurs du cahier des charges | À exécuter sur le prototype |
| [decisions.md](decisions.md) | Justification des bibliothèques et des choix d'architecture | À compléter au fil des ajouts |
| [manquant_logiciel.md](manquant_logiciel.md) | Écart détaillé entre le cadrage et le code actuel, avec plan de travail | Suivi |

## Sources utilisées

- `Omnibasse — doc projet et prompt de démarrage Antigravity.md` (vision, cadrage OSI, contrat d'API, phases)
- `backend/main.py`, `backend/config.py`, `backend/touch_engine.py`, `backend/audio_engine.py`, `backend/hardware/mpr121.py`
- `frontend/src/App.tsx` et `frontend/src/components/`

## Règle de mise à jour

Toute valeur numérique ajoutée doit indiquer sa **source** : code, fiche technique ou mesure. Les valeurs marquées `PROVISOIRE`, `À mesurer` ou `À fixer` ne doivent pas être présentées comme des résultats dans le dossier OSI.

Note : le dossier contient aussi `Modelisation 3D/` avec l'archive du modèle CAO du prototype.
