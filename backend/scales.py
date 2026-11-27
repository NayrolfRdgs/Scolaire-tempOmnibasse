"""
scales.py — Moteur de gammes musicales pour Omnibasse.
Fournit les notes assignées à chaque section d'une corde en fonction
de la gamme sélectionnée, et les conversions note ↔ fréquence.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Tables d'intervalles (demi-tons depuis la fondamentale)
# ---------------------------------------------------------------------------

SCALES: dict[str, list[int]] = {
    "major":                    [0, 2, 4, 5, 7, 9, 11, 12],
    "natural_minor":            [0, 2, 3, 5, 7, 8, 10, 12],
    "harmonic_minor":           [0, 2, 3, 5, 7, 8, 11, 12],
    "dorian":                   [0, 2, 3, 5, 7, 9, 10, 12],
    "phrygian":                 [0, 1, 3, 5, 7, 8, 10, 12],
    "mixolydian":               [0, 2, 4, 5, 7, 9, 10, 12],
    "minor_pentatonic":         [0, 3, 5, 7, 10, 12],
    "minor_pentatonic_octave":  [0, 3, 5, 7, 10, 12],  # exactement 6 notes → parfait pour 6 sections
    "chromatic":                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
}

# Noms des 12 demi-tons (notation internationale)
NOTE_NAMES: list[str] = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Fréquence de référence A4 = 440 Hz (MIDI note 69)
A4_FREQ: float = 440.0
A4_MIDI: int = 69


def _note_name_to_midi(note_name: str) -> int:
    """
    Convertit un nom de note (ex: 'E1', 'A#3') en numéro MIDI.
    Octave 4 → MIDI 60 = C4.
    """
    # Séparer nom et octave
    if len(note_name) >= 3 and note_name[1] == "#":
        name = note_name[:2]
        octave = int(note_name[2:])
    else:
        name = note_name[0]
        octave = int(note_name[1:])

    if name not in NOTE_NAMES:
        raise ValueError(f"Nom de note inconnu : {name!r}")

    semitone = NOTE_NAMES.index(name)
    # MIDI : C4 = 60, donc C(octave) = 12*(octave+1)
    return 12 * (octave + 1) + semitone


def _midi_to_note_name(midi: int) -> str:
    """Convertit un numéro MIDI en nom de note (ex: 69 → 'A4')."""
    octave = (midi // 12) - 1
    semitone = midi % 12
    return f"{NOTE_NAMES[semitone]}{octave}"


def note_to_freq(note_name: str) -> float:
    """
    Convertit un nom de note en fréquence Hz.
    Exemples : E1=41.20, A1=55.00, D2=73.42, G2=98.00.
    """
    midi = _note_name_to_midi(note_name)
    return A4_FREQ * (2.0 ** ((midi - A4_MIDI) / 12.0))


def freq_ratio(source: str, target: str) -> float:
    """
    Calcule le ratio de fréquence entre deux notes (target_freq / source_freq).
    Utilisé pour le pitch-shift par resampling.
    """
    return note_to_freq(target) / note_to_freq(source)


def get_scale_notes(root: str, mode: str, num_sections: int = 6) -> list[str]:
    """
    Retourne les noms des notes assignées aux `num_sections` sections d'une corde.

    La fondamentale `root` peut être spécifiée sans octave (ex: 'E') ; dans ce cas
    l'octave 1 est utilisée. Elle peut aussi inclure l'octave (ex: 'E1').

    Les intervalles de la gamme sont appliqués depuis la note de base de la corde.
    Si la gamme comporte moins de notes que `num_sections`, elle est répétée à l'octave
    supérieure. Si elle en a plus, elle est tronquée.
    """
    if mode not in SCALES:
        raise ValueError(f"Mode inconnu : {mode!r}. Modes disponibles : {list(SCALES.keys())}")

    # Normaliser la fondamentale (sans octave → utiliser l'octave de la note de base)
    # On détermine le MIDI de départ depuis la note de base de la corde
    # (passée séparément via base_note dans StringConfig, donc root ici est juste la tonique)
    # On construit la note racine à l'octave 1 si pas d'octave spécifiée
    if root[-1].isdigit():
        root_note = root
    else:
        root_note = root + "1"

    root_midi = _note_name_to_midi(root_note)
    intervals = SCALES[mode]

    notes: list[str] = []
    idx = 0
    octave_offset = 0

    while len(notes) < num_sections:
        if idx >= len(intervals):
            # Continuer à l'octave supérieure (en reprenant depuis le début sans l'unisson)
            octave_offset += 12
            # Reprendre à partir du 2ème degré pour éviter doublon d'octave
            idx = 1

        interval = intervals[idx] + octave_offset
        midi = root_midi + interval
        notes.append(_midi_to_note_name(midi))
        idx += 1

    return notes[:num_sections]


def get_string_section_notes(
    base_note: str,
    scale_root: str,
    mode: str,
    num_sections: int = 6,
) -> list[str]:
    """
    Retourne les notes pour une corde donnée.
    La corde commence à `base_note` et les sections suivantes suivent la gamme
    calculée depuis `scale_root` en conservant l'octave de `base_note`.
    """
    if mode not in SCALES:
        raise ValueError(f"Mode inconnu : {mode!r}")

    base_midi = _note_name_to_midi(base_note)

    # Trouver la note de départ dans la gamme la plus proche de base_note
    intervals = SCALES[mode]
    notes: list[str] = []
    idx = 0
    octave_offset = 0

    # Forcer la première section = note de base de la corde
    notes.append(_midi_to_note_name(base_midi))

    # Générer les sections suivantes depuis la base_note en suivant la gamme
    # On identifie l'intervalle de base_note dans la gamme depuis root
    root_note = scale_root + "1" if not scale_root[-1].isdigit() else scale_root
    root_midi = _note_name_to_midi(root_note)

    # Décalage base_note → root (en demi-tons, dans l'octave)
    offset = (base_midi - root_midi) % 12

    # Trouver l'index de départ dans la gamme
    start_idx = 0
    for i, iv in enumerate(intervals):
        if iv % 12 == offset:
            start_idx = i
            break

    base_octave_midi = base_midi  # on part de base_midi réel
    cur_idx = start_idx + 1  # section 0 déjà ajoutée
    cur_octave_offset = 0

    while len(notes) < num_sections:
        if cur_idx >= len(intervals):
            cur_octave_offset += 12
            cur_idx = 1  # éviter doublon

        midi = base_octave_midi + (intervals[cur_idx] - intervals[start_idx]) + cur_octave_offset
        notes.append(_midi_to_note_name(midi))
        cur_idx += 1

    return notes[:num_sections]
