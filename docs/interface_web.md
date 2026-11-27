# Interface web de test

La page React sert de surface simulée et de console de réglage. Elle se connecte au même back que le Raspberry Pi, via REST et WebSocket `/ws`.

Lancement : voir [installation.md](installation.md#développement-windows), puis ouvrir http://localhost:5173.

## Onglets disponibles

| Onglet | Rôle | Composant |
| --- | --- | --- |
| **Surface de Jeu** | Grille 4 × 6. La souris ou le doigt glisse et envoie des événements `touch` avec une `pos` continue. | `TouchGrid.tsx` |
| **Capteurs MPR121** | Barres en direct des 24 valeurs brutes pour régler les seuils. | `CalibMonitor.tsx` |
| **Configuration** | Éditeur JSON ; envoie la configuration via `PUT /api/config`. | `ConfigEditor.tsx` |
| **Journal Direct** | Flux WebSocket en direct, jusqu'à 200 lignes, filtrable par source (`all`, `hardware`, `simulator`). | `EventLog.tsx` |

Le panneau latéral contient les 5 potentiomètres simulés : volume, filtre, réverbération, banque de samples et tonalité (`PotSliders.tsx`).

## Prévu mais pas encore branché

| Fonction | État |
| --- | --- |
| Écoute Web Audio dans le navigateur | Composant `WebAudioPlayer.tsx` présent mais non appelé — voir M-06 |
| Onglet **Mesures** (enregistrer, rejouer, délais, CSV) | À créer — voir M-05 |

## Comportement avec le vrai matériel

Quand les MPR121 sont branchés, la même grille s'allume avec les touches réelles. Le journal permet de distinguer les événements `hardware` des événements `simulator`, ce qui sert à comparer les deux sources.

## Contrat utilisé

Les événements envoyés et reçus sont décrits dans [api.md](api.md#websocket-ws). Le format de la configuration est dans [api.md](api.md#configuration-appconfig).
