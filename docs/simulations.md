# Omnibasse — simulations, logiciels et mode d'emploi pas à pas

> Document déplacé dans `docs/`. Index : [docs/README.md](README.md).

Ce guide reprend les simulations annoncées dans `Omnibasse — doc projet et prompt de démarrage Antigravity.md`, les adapte au code actuellement présent dans `backend/`, et explique comment les construire et les exploiter.

> Points importants relevés en lisant le code :
> - La boucle hardware tourne à **100 Hz** (`main.py`, `interval = 1/100`) → pas de temps **10 ms**.
> - Le tampon audio est de **512 échantillons à 44 100 Hz** (`audio_engine.py`) → **11,61 ms** de bloc audio.
> - Le back calcule `pos` par **barycentre pondéré des 6 pads** (`touch_engine.py`, `_interpolate_pos`), et non par le simple rapport `s2/(s1+s2)` écrit dans le doc. Les deux sont expliqués plus bas ; la version barycentre est celle à utiliser pour comparer simulation et réalité.
> - Les routes `/api/recording/*` et `/api/metrics` décrites dans le doc **ne sont pas encore implémentées**. Pour l'instant, les mesures réelles se font via `GET /api/calibration` (voir § 8).

---

## 1. Ce qu'il faut simuler

| # | Simulation | Rôle pour le dossier OSI | Priorité |
| --- | --- | --- | --- |
| 1 | **Position du doigt → note jouée** | Une entrée `x(t)`, une sortie `f(t)`, paramètres justifiés. Relie précision + réactivité. | **Principale** |
| 2 | Circuit **RC seul** | Explique pourquoi la capacité varie quand le doigt approche (tau = R × C). | Secondaire |
| 3 | **Position → fréquence** seule | Vérifie `f = f0 × 2^(n/12)` et l'erreur en cents. | Secondaire |
| 4 | **Budget de latence** | Somme des délais, à comparer aux 20 ms du cahier des charges. | Secondaire |

Objectifs à relever à chaque fois : **retard total < 20 ms**, **erreur de position en mm**, **erreur de hauteur en cents**.

---

## 2. Logiciels nécessaires

| Logiciel | Pourquoi | Statut |
| --- | --- | --- |
| **MATLAB + Simulink** | Simulation imposée par le cadrage OSI. Blocs `Ramp`, `Step`, `Transfer Fcn`, `Gain`, `Sum`, `Scope`, etc. | À installer (licence lycée / MAP). |
| **Python 3.10+** avec `numpy`, `scipy`, `matplotlib`, `requests` | Rejeu des CSV, calcul des erreurs, alternative libre à Simulink, relevé des mesures via l'API. | Partiel : `numpy`/`scipy` sont dans `requirements.txt`, `matplotlib` et `requests` sont à ajouter (voir [decisions.md](decisions.md)). |
| **Tableur** (Excel / LibreOffice Calc) | Visualisation rapide des CSV `temps, pad, valeur`. | Facultatif. |
| **Scilab / Xcos** | Repli libre si MATLAB n'est pas disponible ; mêmes blocs, mêmes formules. | Facultatif. |
| **Backend + page web** | Générer les données réelles à comparer (`start_dev.bat`, `start_frontend.bat`). | Déjà dans le dépôt. |

Commande d'installation Python si besoin :

```bat
cd G:\.Pro\.Dev\Lycee\OM\backend
python -m venv .venv
.venv\Scripts\activate
pip install numpy scipy matplotlib requests
```

---

## 3. Paramètres à réunir **avant** de modéliser

Le doc le rappelle : **aucune valeur de R, C ou de bruit inventée**. Voici d'où vient chaque paramètre.

| Symbole | Grandeur | Source | Valeur déjà connue dans le code |
| --- | --- | --- | --- |
| `Ts` | Pas de temps | Boucle hardware | **0,01 s** (`main.py`) |
| `L` | Longueur utile | Surface | **320 mm** (6 × 64 mm) |
| `pas` | Centre à centre des pads | Surface | **64 mm** → centres `0:64:320` mm |
| `f0` | Note de base de la corde 0 | Config | **E1 = 41,203 Hz** (`config.py`, `scales.py`) |
| `seuil`, `release` | Détection de toucher | Config | **12** et **6** (`config.py`) |
| `tau` | Constante de temps du filtre RC équivalent | Fiche MPR121 **ou mesure** (§ 8) | À relever : registres `CONFIG1=0x10` (CDT 16 µs), `CONFIG2=0x20` (ESI 1 ms), filtres `MHDF=0x05`, `NCLF=0x01` (`mpr121.py`) |
| `sigma` | Largeur de recouvrement du doigt | Mesure (§ 8) | À mesurer |
| `bruit_std` | Écart-type du bruit au repos | Mesure, doigt sec puis humide (§ 8) | À mesurer |
| `t_buffer` | Tampon audio | Code | **512/44100 = 0,01161 s** |
| `t_traitement` | Calcul back | Mesure `/api/metrics` (à implémenter) | Àmesurer |

Pour faire tourner le modèle tout de suite, utilisez des valeurs de démarrage **explicitement provisoires**, puis remplacez-les par vos mesures avant de rédiger le dossier :

```matlab
Ts = 0.01;          % s — imposé par la boucle 100 Hz
L  = 320;           % mm — 6 pads de 64 mm
pas = 64;           % mm
f0 = 41.203;        % Hz — E1
sigma = 12;         % mm — PROVISOIRE, à remplacer par une mesure
tau = 0.008;        % s  — PROVISOIRE, à remplacer par la fiche ou une mesure
bruit_std = 2;      % counts — PROVISOIRE, à remplacer par une mesure
t_buffer = 512/44100;
```

---

## 4. Simulation principale : position du doigt → note jouée

### 4.1 Créer le modèle

1. Ouvrir **MATLAB**.
2. Dans la *Command Window*, taper `simulink` puis **Entrée**.
3. Cliquer sur **Blank Model** (Modèle vierge).
4. **Enregistrer sous** : `G:\.Pro\.Dev\Lycee\OM\simulations\omnibasse_position_note.slx`.
   (Créez le dossier `simulations` à la racine s'il n'existe pas.)
5. Taper les variables du § 3 dans la *Command Window* avant de lancer la simulation.

### 4.2 Configuration du solveur

1. Menu **Simulation → Model Configuration Parameters**.
2. **Solver** :
   - `Type` : **Fixed-step**
   - `Solver` : **discrete (no continuous states)**
   - `Fixed-step size (fundamental sample time)` : `Ts`
   - `Stop time` : `5` (le doigt parcourt 320 mm à 64 mm/s en 5 s)
3. Appliquer.

### 4.3 Bloc entrée : la position x(t)

1. Ouvrir le **Library Browser**.
2. Glisser **Sources → Ramp** dans le modèle.
3. Double-clic : `Slope = 64`, `Start time = 0`, `Initial output = 0`.
   → à t = 5 s, x = 320 mm.
4. Renommer le bloc `x_doigt_mm`.
5. Pour tester un **toucher ponctuel** (échelon) : glisser **Sources → Step**, `Step time = 1`, `Initial value = 0`, `Final value = 320`, et mettre un **Manual Switch** (`Signal Routing`) entre Ramp et Step pour choisir glissando / échelon.

### 4.4 Bloc capteur : les 6 pads

1. Glisser **User-Defined Functions → MATLAB Function**.
2. Double-clic et coller :

```matlab
function s = padShape(x, sigma, ampl)
% x : position du doigt en mm (0..320)
% 6 pads centrés en 0, 64, 128, 192, 256, 320 mm
centres = 0:64:320;
s = ampl * exp(-0.5 * ((x - centres)/sigma).^2);  % 1x6
end
```

3. Dans l'éditeur du bloc, menu **Edit → Edit Data** (ou *Symbols Pane*), déclarer `sigma` et `ampl` comme **Parameter**, `x` comme **Input**, `s` comme **Output**.
4. Relier `x_doigt_mm` à l'entrée `x`. Régler `sigma = sigma` et `ampl = 100` (amplitude crête, comparable aux deltas 0-1023 du MPR121).
5. *Justification à écrire dans le dossier* : une gaussienne modélise le recouvrement du doigt sur deux pads voisins ; la charge RC qui en résulte est représentée par le filtre du § 4.6.

### 4.5 Bloc bruit

1. Glisser **Sources → Random Number**.
2. `Mean = 0`, `Variance = bruit_std^2 * ones(1,6)`, `Sample time = Ts`.
3. Glisser **Math Operations → Sum**, configurer `++` et relier `s` et le bruit.
4. Renommer la sortie `s_bruite`.
5. Variante du doc : utiliser **Sources → Band-Limited White Noise**. Dans ce cas, calibrez la *Noise power* en mettant un bloc **RMS** (`Math Operations`) après le bruit et en ajustant jusqu'à retrouver `bruit_std` mesuré.

### 4.6 Bloc filtre RC équivalent

1. Glisser **Discrete → Discrete Filter**.
2. Double-clic :
   - `Numerator = [Ts/(tau+Ts)]`
   - `Denominator = [1, -(tau/(tau+Ts))]`
   - `Sample time = Ts`
3. Relier `s_bruite` à l'entrée. Sortie : `s_filtre`.
4. *Justification* : approximation backwards-Euler de `1/(tau·s + 1)`, avec `tau = R·C` relevé dans la fiche MPR121 ou déduit de la mesure du § 8.

### 4.7 Bloc position estimée (fidèle au back)

1. Glisser un second **MATLAB Function**, nommé `pos_barycentre`.
2. Coller :

```matlab
function pos = pos_barycentre(s)
% Reproduit touch_engine._interpolate_pos()
idx = 0:5;
pos = sum(s .* idx) / (sum(s) + eps) / 5;   % 0..1
pos = max(0, min(1, pos));
end
```

3. Relier `s_filtre` à l'entrée, sortie `pos`.

**Variante simplifiée du doc (`pos = s2/(s1+s2)`)** : remplacer le bloc par :

```matlab
function pos = pos_rapport(s)
local = s(3) / (s(2) + s(3) + eps);  % pads 1 et 2 (entre 64 et 128 mm)
pos = (1 + local) / 5;               % passage en position globale 0..1
pos = max(0, min(1, pos));
end
```

À n'utiliser que pour le schéma « une entrée / une sortie » du cadrage ; pour la comparaison avec le prototype, garder le barycentre.

### 4.8 Bloc note / fréquence

1. Glisser un troisième **MATLAB Function**, nommé `note_freq`.
2. Coller :

```matlab
function f = note_freq(pos, f0, mode)
% mode = 1 : libre (glissando continu, 1 octave sur la bande)
% mode = 0 : notes (pentatonique mineure + octave, 6 sections)
if mode == 1
    n = 12 * pos;
else
    iv = [0 3 5 7 10 12];
    k = min(5, max(0, round(pos*5)));
    n = iv(k+1);
end
f = f0 * 2^(n/12);
end
```

3. Déclarer `f0` et `mode` comme **Parameters**, `mode = 1` pour la sim principale.

### 4.9 Bloc référence et erreurs

1. Glisser un quatrième **MATLAB Function** :

```matlab
function [e_mm, e_cents, f_ref] = erreurs(x, pos, f, f0)
pos_ref = x / 320;              % position idéale
f_ref   = f0 * 2.^pos_ref;      % fréquence idéale (mode libre)
e_mm    = 320 * (pos - pos_ref);
e_cents = 1200 * log2(max(f,1e-9) ./ f_ref);
end
```

2. Mettre un **Demux** (`Signal Routing`) à la sortie pour séparer `e_mm`, `e_cents` et `f_ref`.

### 4.10 Visualisation et export

1. Glisser trois **Sinks → Scope** :
   - `Scope_x_pos` : entrer `x` et `320*pos` → on voit le retard et l'écart.
   - `Scope_freq` : entrer `f` et `f_ref`.
   - `Scope_erreurs` : entrer `e_mm` et `e_cents`.
2. Glisser six **Sinks → To Workspace** : `x`, `pos`, `f`, `e_mm`, `e_cents`, `f_ref`.
   - Double-clic : `Variable name` = le nom voulu, `Save format` = **Array**.
   - Vérifier dans **Model Configuration Parameters → Data Import/Export** que **Single simulation output** est coché (valeur par défaut).
3. Relier tous les blocs selon la chaîne :

```
Ramp/Step → padShape → (+)bruit → Discrete Filter → pos_barycentre → note_freq → Scope/To Workspace
                                      └→ erreurs(x, pos, f, f0) → Scope_erreurs
```

### 4.11 Lancer et relever les chiffres

1. Cliquer sur **Run** ( ▶ ).
2. Dans la *Command Window*, taper :

```matlab
out = sim('omnibasse_position_note');
t    = out.tout;
x    = out.x;
pos  = out.pos;
f    = out.f;

% Retard : premier franchissement de 64 mm (pad 1) vs pos = 0.2
kx = find(x  >= 64,  1);
kp = find(pos >= 0.2, 1);
retard_ms = 1000 * (t(kp) - t(kx));

fprintf('Retard    = %.2f ms  (cible < 20 ms)\n', retard_ms);
fprintf('Erreur pos max  = %.2f mm\n', max(abs(320*pos - x)));
fprintf('Erreur hauteur max = %.1f cents\n', max(abs(1200*log2(f./(41.203*2.^(x/320))))));
```

3. Noter les trois valeurs dans le dossier, avec les paramètres `tau`, `sigma` et `bruit_std` utilisés.

### 4.12 Interprétation attendue

- Le **retard** mesuré ici ne contient que capteur + filtre. Il faut y ajouter le budget du § 7 pour comparer aux 20 ms complets.
- Une erreur de 1 mm vaut environ **3 cents** si une octave (1200 cents) s'étale sur 320 mm (`1200/320 = 3,75 cents/mm`) ; un demi-ton fait **~26,7 mm** dans cette hypothèse linéaire (le doc annonce ~33 mm pour 40 cm, à recaler sur le mapping réel).
- Si les erreurs sont trop grandes : réduire `tau` (filtre plus rapide) ou réduire `sigma` (doigt moins large), puis relancer.

---

## 5. Simulation 2 : le circuit RC seul

1. Nouveau modèle vierge, enregistré `simulations/rc_mpr121.slx`.
2. **Simulation → Model Configuration Parameters** → `Solver = ode45`, `Stop time = 0.05`.
3. Glisser **Sources → Step** : `Step time = 0.005`, `Initial = 0`, `Final = 3.3`.
4. Glisser **Continuous → Transfer Fcn** : `Numerator = [1]`, `Denominator = [tau 1]` (avec `tau = R*C`).
5. Glisser **Sinks → Scope** et relier.
6. Run. Sur le Scope, lever le curseur à **63,2 % de 3,3 V ≈ 2,09 V** : l'instant lu donne `tau`.
7. Refaire avec deux autres valeurs de `R` ou `C` pour montrer que `tau = R·C` et que le retard augmente avec `tau`.

À écrire dans le dossier : « le MPR121 n'est pas une boîte noire : son entrée est une capacité, sa sortie est un delta numérique ; entre les deux, la charge d'un condensateur suit `u(t) = U0(1 − exp(−t/τ))` avec `τ = R·C`. »

---

## 6. Simulation 3 : position → fréquence seule

1. Nouveau modèle `simulations/position_frequence.slx`.
2. **Ramp** : `Slope = 1`, durée 1 s → `pos` de 0 à 1.
3. **Gain** : `12*log(2)` (c'est-à-dire `n·ln2` avec `n = 12·pos`).
4. **Math Operations → Math Function** : `exp`.
5. **Gain** : `f0` (41,203).
6. **Scope** : courbe `f(t)` de 41,2 Hz à 82,4 Hz.
7. Vérification dans la Command Window :

```matlab
fprintf('f(1) theorique = %.3f Hz\n', 41.203*2);
```

Variante mode notes : remplacer l'échelon continu par le bloc `note_freq` du § 4.8 avec `mode = 0` ; la fréquence monte alors par 6 marches `[0 3 5 7 10 12]` demi-tons.

---

## 7. Simulation 4 : budget de latence

### 7.1 Dans Simulink

1. Nouveau modèle `simulations/budget_latence.slx`.
2. **Step** à `t = 0` (`Initial = 0`, `Final = 1`).
3. Mettre en série quatre **Continuous → Transport Delay** :
   - `Ts` = `0,01` (lecture MPR121 / boucle 100 Hz)
   - `tau` = constante de temps du filtre (mesurée)
   - `t_traitement` = temps de calcul back (àmesurer)
   - `t_buffer` = `512/44100` = `0,01161`
4. **Scope** à la sortie : la valeur ne passe à 1 qu'après la somme des délais.
5. Lire l'instant de franchissement : c'est le délai bout en bout prévu.

### 7.2 Calcul direct équivalent

```matlab
Ts = 0.01; tau = 0.008; t_traitement = 0.002; t_buffer = 512/44100;
total_ms = 1000*(Ts + tau + t_traitement + t_buffer);
fprintf('Budget = %.2f ms\n', total_ms);
```

### 7.3 Constat important

Même sans filtre ni traitement : `10 + 11,61 = 21,61 ms` **> 20 ms**. Le cahier des charges est donc serré. Pistes à consigner :

- réduire le bloc audio de 512 à 256 échantillons (5,8 ms) ;
- réduire la période de lecture capteur si le MPR121 le permet (ESI configurable dans `CONFIG2`) ;
- prévoir le passage du moteur audio en Rust (`cpal`) comme indiqué dans le doc, sans toucher à l'API.

---

## 8. Comparer simulation et prototype

### 8.1 Relever les valeurs brutes (en attendant les routes `/api/recording/*`)

1. Lancer le back : `start_dev.bat`, puis le frontend : `start_frontend.bat`.
2. Depuis un terminal, lancer ce script :

```python
# simulations/releve_calibration.py
import csv, time, requests

with open("pad_mesures.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["t", "pad", "valeur"])
    t0 = time.time()
    for _ in range(600):                      # 6 s à 100 Hz
        data = requests.get(
            "http://127.0.0.1:8000/api/calibration", timeout=0.2
        ).json()
        t = time.time() - t0
        for pad, val in sorted(data["channels"].items(), key=lambda kv: int(kv[0])):
            w.writerow([round(t, 6), pad, val])
        time.sleep(0.01)
print("CSV écrit : pad_mesures.csv")
```

3. Glisser le doigt sur une corde avec un repère tous les 5 mm. Noter la position réelle en face de chaque instant.
4. Mesurer aussi le **bruit au repos**, doigt sec puis doigt humide : `bruit_std = écart-type des valeurs`.
5. Mesurer `tau` : faire un toucher échelon, prendre l'instant où le delta atteint 63,2 % de sa valeur finale.

> Limite à écrire dans le dossier : l'interrogation HTTP ajoute son propre délai. Pour une mesure fiable, il faudra implémenter `POST /api/recording/start`, `/stop`, `GET /api/recording/{id}.csv` et `GET /api/metrics` (phase 3 du doc).

### 8.2 Réinjecter le CSV dans Simulink

1. Glisser **Sources → From Spreadsheet** dans le modèle principal.
2. `File name = pad_mesures.csv`, `Sample time = Ts`.
3. Ajouter un **Select** (`Signal Routing`) pour ne garder que les 6 canaux d'une corde (par exemple canaux 0 à 5).
4. Remplacer le bloc `padShape` par ce flux, puis comparer `pos` simulé et `pos` issu du back sur le même Scope.
5. Écarts à commenter : bruit non gaussien, hystérésis (`hysteresis = 0,05`), arbitrage de corde dominante, quantification d'échelon.

---

## 9. Alternative libre : même simulation en Python

À placer dans `simulations/sim_position_note.py`. Remplacer les trois valeurs `PROVISOIRE` par vos mesures.

```python
"""Reproduit la simulation principale sans MATLAB."""
import numpy as np

Ts = 0.01                    # boucle 100 Hz
L = 320.0                    # mm
pas = 64.0                   # mm
f0 = 41.203                  # E1
sigma = 12.0                 # PROVISOIRE — mesurer
tau = 0.008                  # PROVISOIRE — fiche/mesure
bruit_std = 2.0              # PROVISOIRE — mesurer
t_buffer = 512 / 44100

t = np.arange(0, 5, Ts)
x = np.clip(64 * t, 0, L)

centres = np.arange(0, 321, 64, dtype=float)          # 6 pads
rng = np.random.default_rng(0)

# Capteur : gaussienne + bruit + filtre passe-bas 1/(tau s + 1)
s = 100 * np.exp(-0.5 * ((x[:, None] - centres) / sigma) ** 2)
s += rng.normal(0, bruit_std * np.ones(6), size=s.shape)
a = Ts / (tau + Ts)
sf = np.zeros_like(s)
sf[0] = a * s[0]
for k in range(1, len(t)):
    sf[k] = a * s[k] + (1 - a) * sf[k - 1]

# Position (barycentre, comme touch_engine.py) et fréquence libre
idx = np.arange(6)
pos = (sf @ idx) / (sf.sum(axis=1) + 1e-12) / 5
pos = np.clip(pos, 0, 1)
f = f0 * 2 ** (12 * pos)

# Métriques
kx = np.argmax(x >= 64)
kp = np.argmax(pos >= 0.2)
retard_ms = 1000 * (t[kp] - t[kx])
err_mm = np.max(np.abs(L * pos - x))
err_cents = np.max(np.abs(1200 * np.log2(f / (f0 * 2 ** (x / L)))))
budget_ms = 1000 * (Ts + tau + 0.002 + t_buffer)

print(f"Retard capteur+filtre : {retard_ms:.2f} ms")
print(f"Erreur position max   : {err_mm:.2f} mm")
print(f"Erreur hauteur max    : {err_cents:.1f} cents")
print(f"Budget complet        : {budget_ms:.2f} ms  (cible < 20 ms)")
```

Lancement :

```bat
cd G:\.Pro\.Dev\Lycee\OM
python simulations\sim_position_note.py
```

---

## 10. Check-list avant de rendre le dossier

- [ ] Modèle `omnibasse_position_note.slx` enregistré avec une entrée et une sortie claires.
- [ ] Tableau des paramètres avec **source** pour `tau`, `sigma`, `bruit_std` (fiche MPR121 ou mesure).
- [ ] Courbes simulées + courbes mesurées superposées, écarts expliqués.
- [ ] Trois chiffres relevés : retard (ms), erreur (mm), erreur (cents).
- [ ] Budget de latence comparé à 20 ms, avec la remarque sur le tampon 512.
- [ ] Précision dans le dossier que `pos` dans le back est un **barycentre sur 6 pads**, pas un rapport 2 pads.
- [ ] Grille UPSTI lue avant de figer les critères (point ouvert du doc source).
- [ ] Routes d'enregistrement/métriques implémentées pour remplacer le script HTTP du § 8.

---

## 11. Ordre de travail recommandé

1. Faire tourner la simulation principale avec les valeurs provisoires (§ 4) pour comprendre la chaîne.
2. Mesurer `sigma`, `bruit_std` et `tau` sur le prototype (§ 8) et les reporter dans les blocs.
3. Relancer, puis faire le budget de latence (§ 7) : c'est lui qui dira si le Rust est nécessaire.
4. Rédiger les deux simulations secondaires (§ 5 et § 6) pour expliquer le principe au jury.
5. Remplacer le relevé HTTP par les vraies routes d'enregistrement dès que la phase 3 est faite.
