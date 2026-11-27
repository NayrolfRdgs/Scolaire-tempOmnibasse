# Dépannage courant

## Le backend ne démarre pas

```text
ModuleNotFoundError: No module named 'fastapi'
```

Le virtualenv n'est pas activé.

- Windows : `.venv\Scripts\activate`
- Linux / Pi : `source .venv/bin/activate`

Puis réinstaller si besoin : `pip install -r requirements.txt`.

---

## Pas de son

- Vérifier `sounddevice` : `pip show sounddevice`
- Sur le Pi, lister les cartes son : `aplay -l`
- Sur Windows, vérifier le périphérique audio par défaut
- Vérifier que la banque est chargée : `GET /api/samples` doit renvoyer `bass-default`
- Attention : les WAV du back sont dans `backend/samples/` et sont ignorés par Git ; les WAV du navigateur sont dans `frontend/public/samples/`

Voir aussi [M-07](manquant_logiciel.md#m-07--samples-absents).

---

## MPR121 non détecté

```bash
i2cdetect -y 1
```

Doit afficher `5a` et `5b`. Sinon :

- vérifier le câblage SDA/SCL et l'alimentation 3,3 V ;
- activer l'I2C : `sudo raspi-config` → *Interface Options* → *I2C* ;
- vérifier la broche `ADDR` : GND = `0x5A`, 3,3 V = `0x5B`, SDA = `0x5C`, SCL = `0x5D`.

Schémas et mapping : [hardware.md](hardware.md).

---

## Touches trop sensibles ou pas assez

Modifier `touch.threshold` et `touch.release` via `PUT /api/config` ou depuis l'onglet Configuration du frontend. Observer les valeurs brutes avec l'onglet Capteurs MPR121, puis suivre le [protocole P2](protocole_mesures.md#p2--bruit-sec--humide).

---

## Service systemd qui ne démarre pas

```bash
sudo journalctl -u omnibasse -n 50
```

Causes fréquentes :

- chemin du virtualenv incorrect dans `backend/omnibasse.service` ;
- permissions sur `/home/pi/omnibasse` ;
- port 8000 déjà utilisé : `ss -tlnp | grep 8000`.

Installation : [installation.md](installation.md#raspberry-pi).

---

## Latence supérieure à 20 ms

Le budget théorique est déjà de `10 ms` (boucle capteur) + `11,61 ms` (tampon audio) avant même le filtre et le traitement. Voir [simulations.md](simulations.md#7-simulation-4--budget-de-latence) puis mesurer avec le [protocole P4](protocole_mesures.md#p4--latence).

---

## Autres écarts connus

La liste complète des fonctionnalités manquantes ou partielles est dans [manquant_logiciel.md](manquant_logiciel.md).
