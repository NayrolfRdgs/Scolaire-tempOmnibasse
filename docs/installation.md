# Installation et lancement

## Prérequis

| Environment | Versions |
| --- | --- |
| Windows (développement) | Python 3.10+, Node.js 18+, npm |
| Raspberry Pi (production) | Raspberry Pi 4 ou 5, Python 3.10+, carte son USB ou DAC, I2C activé |

---

## Développement Windows

### Backend

```bat
cd G:\.Pro\.Dev\Lycee\OM\backend

python -m venv .venv
.venv\Scripts\activate

pip install -r requirements.txt
copy .env.example .env

python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Le raccourci `start_dev.bat` fait la même chose.

### Frontend

```bat
cd G:\.Pro\.Dev\Lycee\OM\frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173. Le raccourci `start_frontend.bat` lance également le frontend.

À ce stade, `MockHardware` est utilisé automatiquement : aucun MPR121 n'est nécessaire. Les gestes sont simulés depuis la grille web.

---

## Raspberry Pi

Le dépôt est **privé** : le clone nécessite un token ou des identifiants GitHub autorisés.

```bash
git clone https://github.com/NayrolfRdgs/Scolaire-tempOmnibasse.git /home/pi/omnibasse
cd /home/pi/omnibasse/backend

chmod +x install_pi.sh
sudo ./install_pi.sh
```

Le script :

1. installe les dépendances système (`i2c-tools`, `python3-venv`, …) ;
2. active le bus I2C ;
3. crée le virtualenv et installe les paquets Python ;
4. installe et active le service systemd `omnibasse`.

### Vérification du service

```bash
sudo systemctl status omnibasse
sudo journalctl -u omnibasse -f
```

Le démarrage automatique est décrit dans `backend/omnibasse.service`.

---

## Configuration

La configuration est chargée depuis `backend/config.json` si le fichier existe, sinon depuis les valeurs par défaut de `backend/config.py`. Elle est modifiable à chaud via `PUT /api/config` ou l'éditeur de configuration du frontend. Voir [api.md](api.md#configuration-appconfig).

Les variables d'environnement sont documentées dans `backend/.env.example`.

---

## Dépannage

Voir [depannage.md](depannage.md).
