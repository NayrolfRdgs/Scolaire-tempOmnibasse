"""Relevé des 24 valeurs brutes via GET /api/calibration.

Lancer le back (start_dev.bat) avant ce script. Produit pad_mesures.csv
au format : t, pad, valeur — directement exploitable par Simulink/Python.
"""
import csv
import time

import requests

URL = "http://127.0.0.1:8000/api/calibration"
DUREE_S = 6
FREQ_HZ = 100

with open("pad_mesures.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["t", "pad", "valeur"])
    t0 = time.time()

    for _ in range(DUREE_S * FREQ_HZ):
        data = requests.get(URL, timeout=0.2).json()
        t = time.time() - t0
        for pad, valeur in sorted(data["channels"].items(), key=lambda kv: int(kv[0])):
            writer.writerow([round(t, 6), pad, valeur])
        time.sleep(1 / FREQ_HZ)

print("CSV écrit : pad_mesures.csv")
