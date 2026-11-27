# Scolaire-tempOmnibasse

> **Projet scolaire** — Omnibasse, instrument tactile capacitif. Lycée, Olympiades de sciences de l'ingénieur 2027 (thème « L'ingénierie au service de l'art »). Dépôt privé, usage pédagogique interne.

Instrument de musique électronique à 4 cordes × 6 sections (24 zones capacitives), piloté par un Raspberry Pi et testable depuis le navigateur.

- **Mode Notes** : chaque section joue une note quantifiée sur la gamme configurée.
- **Mode Libre** : la position du doigt produit un pitch-bend continu.

---

## Démarrage rapide

```bat
:: Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

```bat
:: Frontend (dans un second terminal)
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173. Les raccourcis `start_dev.bat` et `start_frontend.bat` font la même chose.

Aucun hardware n'est nécessaire pour développer : `MockHardware` et la grille web simulent la surface. Installation complète, Raspberry Pi et dépannage : [docs/installation.md](docs/installation.md).

---

## Documentation

Le détail est réparti dans [`docs/`](docs/README.md) :

| Besoin | Document |
| --- | --- |
| Installer / lancer | [installation.md](docs/installation.md) |
| Comprendre l'architecture | [architecture.md](docs/architecture.md) |
| Utiliser l'API | [api.md](docs/api.md) |
| Câbler le matériel | [hardware.md](docs/hardware.md) |
| Utiliser la page web | [interface_web.md](docs/interface_web.md) |
| Résoudre un problème | [depannage.md](docs/depannage.md) |
| Cahier des charges OSI | [cahier_des_charges.md](docs/cahier_des_charges.md) |
| Simulations Simulink / Python | [simulations.md](docs/simulations.md) |
| Protocoles de mesure | [protocole_mesures.md](docs/protocole_mesures.md) |
| Choix et licences | [decisions.md](docs/decisions.md) |
| Ce qui reste à créer | [manquant_logiciel.md](docs/manquant_logiciel.md) |
| Répartition et calendrier | [repartition_taches.md](docs/repartition_taches.md) |

---

## Structure

```text
.
├── backend/        API FastAPI, moteur tactile, audio, drivers I2C
├── frontend/       Interface React/Vite de test
├── docs/           Toute la documentation du projet
├── simulations/    Scripts Python de simulation et de relevé
└── start_*.bat     Raccourcis Windows
```

---

## Licence

Projet pédagogique — usage interne lycée. Les bibliothèques utilisées et leurs licences sont justifiées dans [docs/decisions.md](docs/decisions.md).
