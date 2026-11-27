# Répartition des tâches et emploi du temps

Projet : **Scolaire-tempOmnibasse** (Omnibasse, OSI 2027). Mis à jour le 27/11/2026.

## Les personnes

| Personne | Ce qu'il fait |
| --- | --- |
| **Florian (moi)** | Développement du code, intégration, mesures, dépôt GitHub |
| **Raphaël** | Simulations Simulink, comparaison simulé / mesuré |
| **Marin** | Sampling, avis technique, réglages du son |
| **Rayane** | Modélisation 3D, schémas et planches CAO |

## Déjà fait avant le 03/12/2026

- **Florian** : backend (API, moteur tactile, audio), frontend, dépôt GitHub privé, dossier `docs/`.
- **Marin** : banques de samples présentes dans le projet.
- **Rayane** : modèles 3D livrés.
- **Raphaël** : démarrage des simulations le 03/12/2026.

## Emploi du temps

Séances le **jeudi et le vendredi**, dates au format **JJ/MM/AAAA**.
Chaque personne a une tâche le même jour.
Légende : `☐` = prévu, `☑` = fait (remplacer la case quand c'est terminé).

| Date | Florian | Raphaël | Marin | Rayane |
| --- | --- | --- | --- | --- |
| 03/12/2026 | Lire le cahier des charges, répartir les tickets ☐ | Lire le cahier des charges, installer Simulink ☐ | Écouter les samples existants, noter les défauts ☐ | Ouvrir les modèles 3D, vérifier les dimensions ☐ |
| 10/12/2026 | M-01 : routes recording/start, stop, CSV ☐ | Bloc Simulink : lecture du CSV ☐ | Choisir la forme d'onde des samples basse ☐ | Dessiner le plan des 24 pads ☐ |
| 11/12/2026 | M-02 : champ `timing` et `/api/metrics` ☐ | Bloc Simulink : horodatage ☐ | Régler volume et filtre des samples ☐ | Convertir le plan en plaques cuivre ☐ |
| 17/12/2026 | M-03 : filtre passe-bas `tau` ☐ | Simu 1 : capacité / position ☐ | Tester les samples dans le navigateur ☐ | Vue 3D éclatée de la surface ☐ |
| 18/12/2026 | M-04 : hystérésis + M-14 : dépendances ☐ | Simu 2 : bruit sec / humide ☐ | Documenter les réglages audio ☐ | Exporter les planches 2D ☐ |
| 07/01/2027 | M-05 : onglet Mesures (boutons) ☐ | Simu 3 : filtre `1/(tau·s+1)` ☐ | Choisir les 6 notes E1 à E2 ☐ | Imprimer le gabarit des pads ☐ |
| 08/01/2027 | M-06 : brancher WebAudioPlayer ☐ | Simu 4 : budget de latence ☐ | Générer les 6 WAV du backend ☐ | Vérifier l'écart de 2 mm entre pads ☐ |
| 14/01/2027 | M-07 : script `generate_samples.py` ☐ | Comparer les 2 formules de position ☐ | Valider l'attaque des notes à l'écoute ☐ | Assembler le prototype cuivre ☐ |
| 15/01/2027 | M-10 : `config.json` par défaut ☐ | Préparer le relevé P3 dans Simulink ☐ | Régler la réverbération ☐ | Coller les bandes sur le support 3D ☐ |
| 21/01/2027 | M-08 : tests scales et touch_engine ☐ | Exporter les courbes simulées ☐ | Mesurer le bruit des samples ☐ | Photo du prototype monté ☐ |
| 22/01/2027 | M-08 : tests API et WebSocket ☐ | Vérifier le budget 21,61 ms ☐ | Avis technique sur la latence audio ☐ | Mettre à jour `hardware.md` (schéma) ☐ |
| 28/01/2027 | M-11 : classe `AnalogInputs` (ADC) ☐ | Préparer la grille de relevé P1 ☐ | Tester les pots volume / filtre à l'oreille ☐ | Câbler les 5 potentiomètres ☐ |
| 29/01/2027 | Câblage logiciel des 2 MPR121 ☐ | Préparer la grille de relevé P2 ☐ | Relever les niveaux de sortie ☐ | Câbler les deux MPR121 ☐ |
| 04/02/2027 | P1 : relevé capacité / position ☐ | Saisir les données P1 ☐ | Écouter pendant le relevé ☐ | Tenir le doigt témoin, mesurer ☐ |
| 05/02/2027 | P2 : bruit sec / humide ☐ | Saisir les données P2, calculer `sigma` ☐ | Observer l'effet du bruit sur le son ☐ | Varier l'humidité du doigt ☐ |
| 11/02/2027 | P3 : mesure de `tau` ☐ | Caler `tau` dans Simulink ☐ | Vérifier que le filtre n'écrase pas l'attaque ☐ | Schéma de mesures P3 ☐ |
| 12/02/2027 | P4 : latence + `/api/metrics` ☐ | Calculer les délais par étage ☐ | Mesure latence audio au micro ☐ | Chronométrer les essais ☐ |
| 18/02/2027 | P5 : distinction des zones ☐ | Analyser les résultats P5 ☐ | Jouer les 24 notes, noter les erreurs ☐ | Repérer les zones sur le plan 3D ☐ |
| 19/02/2027 | P6 : précision de la position ☐ | Courbes simulées vs mesurées ☐ | Tester le glissement pitch-bend ☐ | Diagramme des tolérances ☐ |
| 25/02/2027 | M-12 : upload WAV + M-13 : variable d'entrée ☐ | Figer les courbes comparées ☐ | Choisir la banque définitive ☐ | Rendu CAO final ☐ |
| 26/02/2027 | Archiver les CSV dans `docs/mesures/` ☐ | Rédiger la synthèse des essais ☐ | Noter les réglages audio finaux ☐ | Exporter les plans pour le dossier ☐ |
| 04/03/2027 | Vérifier EX-01 à EX-12 une par une ☐ | Vérifier la traçabilité des simulations ☐ | Vérifier EX-05 et EX-08 (audio) ☐ | Vérifier EX-02 (distinction des zones) ☐ |
| 05/03/2027 | Préparer les questions pour l'enseignant ☐ | Préparer la lecture de la grille UPSTI ☐ | Préparer la démo sonore ☐ | Préparer la maquette 3D ☐ |
| 11/03/2027 | Inscription Adage avec l'enseignant ☐ | Corriger les critères EX-02 et EX-03 ☐ | Répéter la démo audio ☐ | Imprimer la maquette ☐ |
| 12/03/2027 | Figer le cahier des charges ☐ | Figer les valeurs de simulation ☐ | Figer la banque de samples ☐ | Figer les planches CAO ☐ |
| 18/03/2027 | Rédiger `architecture.md` et `api.md` ☐ | Rédiger le chapitre simulation ☐ | Rédiger le chapitre audio ☐ | Rédiger le chapitre matériel / CAO ☐ |
| 19/03/2027 | Rédiger le chapitre mesures ☐ | Insérer les courbes dans le dossier ☐ | Insérer les captures audio ☐ | Insérer les vues 3D ☐ |
| 25/03/2027 | Relire le dossier v1 ☐ | Vérifier tous les chiffres ☐ | Vérifier les notes et les samples ☐ | Vérifier les cotes ☐ |
| 26/03/2027 | Corriger le dossier v1 ☐ | Corriger les courbes ☐ | Corriger les réglages audio ☐ | Corriger les planches ☐ |
| 01/04/2027 | Répétition : partie code ☐ | Répétition : partie simulation ☐ | Répétition : démo son ☐ | Répétition : maquette ☐ |
| 02/04/2027 | Corriger après répétition 1 ☐ | Corriger le discours simulation ☐ | Corriger la démo sonore ☐ | Corriger la maquette ☐ |
| 08/04/2027 | Répétition 2 : démonstration complète ☐ | Répétition 2 : courbes ☐ | Répétition 2 : son ☐ | Répétition 2 : 3D ☐ |
| 09/04/2027 | Corriger après répétition 2 ☐ | Refaire les diaporamas ☐ | Rééquilibrer les niveaux ☐ | Retoucher les rendus ☐ |
| 15/04/2027 | Dossier final : mise en page ☐ | Dossier final : figures ☐ | Dossier final : annexes audio ☐ | Dossier final : annexes CAO ☐ |
| 16/04/2027 | Vérifier les liens GitHub ☐ | Vérifier les légendes ☐ | Vérifier les noms de samples ☐ | Vérifier les échelles ☐ |
| 22/04/2027 | Figer la version finale du dossier ☐ | Relire les exigences ☐ | Tester la démo une dernière fois ☐ | Préparer le panneau d'exposition ☐ |
| 23/04/2027 | Vérifier les valeurs `PROVISOIRE` restantes ☐ | Vérifier les unités ☐ | Vérifier le volume final ☐ | Vérifier le support imprimé ☐ |
| 29/04/2027 | Répétition générale : présente le code ☐ | Répétition générale : présente les simulations ☐ | Répétition générale : présente le son ☐ | Répétition générale : présente la 3D ☐ |
| 30/04/2027 | Répétition générale : enchaînement ☐ | Répétition générale : enchaînement courbes ☐ | Répétition générale : enchaînement démo ☐ | Répétition générale : enchaînement maquette ☐ |
| 06/05/2027 | Ajuster le timing de présentation ☐ | Ajuster les courbes affichées ☐ | Ajuster le volume de démo ☐ | Ajuster l'ordre des planches ☐ |
| 07/05/2027 | Répéter transition code → simulation ☐ | Répéter transition simulation → mesures ☐ | Répéter transition son → explication ☐ | Répéter transition 3D → démo ☐ |
| 13/05/2027 | Dernière répétition : code ☐ | Dernière répétition : chiffres ☐ | Dernière répétition : oreille ☐ | Dernière répétition : maquette ☐ |
| 14/05/2027 | Ranger le dépôt et les docs ☐ | Ranger les fichiers de mesure ☐ | Ranger les banques WAV ☐ | Ranger les fichiers CAO ☐ |
| 20/05/2027 | Checklist matériel et PC ☐ | Checklist diaporama ☐ | Checklist carte son et samples ☐ | Checklist maquette et affiches ☐ |
| 21/05/2027 | Chargement final de la démo ☐ | Ouvrir les courbes ☐ | Tester le son sur le lieu ☐ | Installer la maquette ☐ |
| 27/05/2027 | Finale : partie code ☐ | Finale : simulations ☐ | Finale : son ☐ | Finale : 3D ☐ |
| 28/05/2027 | Finale : questions jury (technique) ☐ | Finale : questions (modélisation) ☐ | Finale : questions (audio) ☐ | Finale : questions (CAO) ☐ |

Les vacances de Noël (24/12/2026 au 01/01/2027) et les dates de la finale sont à confirmer avec l'académie.
