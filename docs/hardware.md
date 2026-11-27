# Matériel et câblage

## Surface et capteurs

| Élément | Choix | Statut |
| --- | --- | --- |
| Surface | 4 bandes × 6 sections, ~400 mm × 45–50 mm | Validé |
| Pads | Ruban de cuivre au prototype, plaquettes de laiton ensuite ; ~64 mm × 9–10 mm, 2 mm d'écart | Validé |
| Capteurs | 2 × MPR121 en I2C, adresses `0x5A` et `0x5B` (24 canaux) | Validé |
| Cerveau | Raspberry Pi 4 ou 5 + carte son USB ou DAC | Validé |
| Potentiomètres | ADS1115 (I2C) ou MCP3008 (SPI), 5 entrées | À choisir (point O6) |
| Dynamique | Capteur de force FSR optionnel, sinon valeur de capacité | Option |

Les bandes font 11–12 mm chacune : un doigt peut toucher deux cordes. Le logiciel ne retient que la corde au signal le plus fort.

## MPR121 × 2 via I2C

```text
Raspberry Pi          MPR121 (chip A, addr 0x5A)
─────────────         ──────────────────────────
3.3V  (pin 1)  ──────► VCC
GND   (pin 6)  ──────► GND
SDA   (pin 3)  ──────► SDA
SCL   (pin 5)  ──────► SCL
                       ADDR ── GND (→ 0x5A)

                       MPR121 (chip B, addr 0x5B)
                       ──────────────────────────
                       VCC ◄── 3.3V (pin 1)
                       GND ◄── GND  (pin 6)
                       SDA ◄── SDA  (pin 3)  [bus partagé]
                       SCL ◄── SCL  (pin 5)  [bus partagé]
                       ADDR ── 3.3V (→ 0x5B)
```

### Mapping des canaux

| Chip | Canaux | Cordes / sections |
| --- | --- | --- |
| A (`0x5A`) | 0–5 | corde 0, sections 0–5 |
| A (`0x5A`) | 6–11 | corde 1, sections 0–5 |
| B (`0x5B`) | 0–5 (canaux globaux 12–17) | corde 2, sections 0–5 |
| B (`0x5B`) | 6–11 (canaux globaux 18–23) | corde 3, sections 0–5 |

Le driver lit les registres *filtered data* et soustrait la *baseline* pour obtenir un delta positif au contact. Les registres de filtrage et de seuils sont configurés dans `backend/hardware/mpr121.py`.

## Potentiomètres

### Option A — MCP3008 (SPI)

```text
Raspberry Pi          MCP3008
MOSI (pin 19) ──────► DIN
MISO (pin 21) ◄────── DOUT
SCLK (pin 23) ──────► CLK
CE0  (pin 24) ──────► CS/SHDN
3.3V (pin 1)  ──────► VDD + VREF
GND  (pin 6)  ──────► DGND + AGND
Canaux CH0–CH4 → 5 potentiomètres
```

### Option B — ADS1115 (I2C, 16 bits)

Partage le bus I2C avec les MPR121. Adresse par défaut `0x48`. Quatre canaux A0–A3 : le 5ᵉ potentiomètre nécessite un second ADS1115 à `0x49`.

> La lecture ADC n'est pas encore implémentée : `read_pots()` renvoie des valeurs fixes. Voir [manquant_logiciel.md](manquant_logiciel.md#m-11--adc-des-potentiomètres).

## Vérification et calibration

```bash
i2cdetect -y 1
```

Doit afficher `5a` et `5b`. Pour régler les seuils, utiliser le `CalibMonitor` du frontend puis modifier `touch.threshold` et `touch.release` via `PUT /api/config`. Protocole complet : [protocole_mesures.md](protocole_mesures.md).

Dépannage : [depannage.md](depannage.md).
