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

Aucun hardware n'est nécessaire pour développer : `MockHardware` et la grille web simulent la surface. Voir le [guide technique](docs/technique/guide_technique.md).

---

## Documentation

Tout est dans [`docs/`](docs/README.md), rangé en deux dossiers :

- [`technique/`](docs/technique/guide_technique.md) — installation, architecture, API, câblage, interface web, dépannage (1 seul fichier).
- [`projet/`](docs/projet/cahier_des_charges.md) — cahier des charges, simulations, protocoles de mesure, décisions, écarts logiciels, répartition des tâches.

---

## Structure

```text
.
├── backend/        API FastAPI, moteur tactile, audio, drivers I2C
├── frontend/       Interface React/Vite de test
├── docs/           Documentation (projet/ et technique/)
├── simulations/    Scripts Python de simulation et de relevé
└── start_*.bat     Raccourcis Windows
```

---

## Licence

Projet pédagogique — usage interne lycée. Les bibliothèques utilisées et leurs licences sont justifiées dans [docs/projet/decisions.md](docs/projet/decisions.md).
