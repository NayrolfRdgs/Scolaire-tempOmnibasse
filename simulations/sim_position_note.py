"""Reproduit la simulation principale d'Omnibasse sans MATLAB.

Remplacer les trois valeurs PROVISOIRE par les mesures relevées sur le
prototype ou par les valeurs de la fiche technique du MPR121.
"""
import numpy as np

Ts = 0.01  # boucle 100 Hz (main.py)
L = 320.0  # mm — 6 pads de 64 mm
pas = 64.0  # mm — centre à centre
f0 = 41.203  # Hz — E1 (config.py / scales.py)
sigma = 12.0  # PROVISOIRE — mesurer le recouvrement du doigt
tau = 0.008  # PROVISOIRE — fiche MPR121 ou mesure du 63,2 %
bruit_std = 2.0  # PROVISOIRE — mesurer au repos
t_traitement = 0.002  # PROVISOIRE — à relever via /api/metrics
t_buffer = 512 / 44100  # audio_engine.py

t = np.arange(0, 5, Ts)
x = np.clip(64 * t, 0, L)  # glissando : 64 mm/s pendant 5 s

# Capteur : recouvrement gaussien + bruit + filtre RC 1/(tau s + 1)
centres = np.arange(0, 321, 64, dtype=float)
rng = np.random.default_rng(0)
s = 100 * np.exp(-0.5 * ((x[:, None] - centres) / sigma) ** 2)
s += rng.normal(0, bruit_std * np.ones(6), size=s.shape)

a = Ts / (tau + Ts)  # approximation backwards-Euler
sf = np.zeros_like(s)
sf[0] = a * s[0]
for k in range(1, len(t)):
    sf[k] = a * s[k] + (1 - a) * sf[k - 1]

# Position : barycentre des 6 pads, comme touch_engine._interpolate_pos()
idx = np.arange(6)
pos = (sf @ idx) / (sf.sum(axis=1) + 1e-12) / 5
pos = np.clip(pos, 0, 1)

# Fréquence : mode libre, une octave sur toute la bande
f = f0 * 2 ** (12 * pos)
f_ref = f0 * 2 ** (x / L)

# Métriques du cahier des charges
kx = np.argmax(x >= 64)
kp = np.argmax(pos >= 0.2)
retard_ms = 1000 * (t[kp] - t[kx])
err_mm = np.max(np.abs(L * pos - x))
err_cents = np.max(np.abs(1200 * np.log2(f / f_ref)))
budget_ms = 1000 * (Ts + tau + t_traitement + t_buffer)

print(f"Retard capteur + filtre : {retard_ms:.2f} ms")
print(f"Erreur position max     : {err_mm:.2f} mm")
print(f"Erreur hauteur max      : {err_cents:.1f} cents")
print(f"Budget complet          : {budget_ms:.2f} ms  (cible < 20 ms)")
