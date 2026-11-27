"""
audio_engine.py — Moteur audio pour Omnibasse.

Responsabilités :
- Chargement des samples WAV en RAM (numpy float32)
- Polyphonie 4 voix avec vol-stealing
- Pitch-shift par resampling (ratio fréquence cible / fréquence sample)
- Filtre passe-bas IIR (butterworth 2nd ordre)
- Paramètres en temps réel : volume, filtre, reverb
- Sortie via sounddevice (dégradation gracieuse si absent)
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Import optionnel de sounddevice
# ---------------------------------------------------------------------------
try:
    import sounddevice as sd  # type: ignore
    _SD_AVAILABLE = True
except (ImportError, OSError):
    sd = None  # type: ignore
    _SD_AVAILABLE = False
    logger.warning("sounddevice non disponible — sortie audio désactivée.")

# Import optionnel de scipy
try:
    from scipy.signal import butter, lfilter, resample_poly  # type: ignore
    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False
    logger.warning("scipy non disponible — pitch-shift et filtre désactivés.")

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

SAMPLE_RATE: int = 44100          # Hz
NUM_VOICES: int = 4               # Polyphonie max
SAMPLES_DIR: Path = Path(__file__).parent / "samples"

FILTER_FREQ_MIN: float = 200.0    # Hz (valeur pot 0.0)
FILTER_FREQ_MAX: float = 8000.0   # Hz (valeur pot 1.0)


# ---------------------------------------------------------------------------
# Structures internes
# ---------------------------------------------------------------------------

@dataclass
class Voice:
    """Une voix de polyphonie."""
    string_id: int = -1
    section: int = -1
    # Buffer audio de la voix (numpy float32 mono)
    buffer: np.ndarray = field(default_factory=lambda: np.zeros(0, dtype=np.float32))
    pos: int = 0           # Position de lecture dans buffer
    active: bool = False
    start_time: float = 0.0
    volume: float = 1.0

    def is_done(self) -> bool:
        return not self.active or self.pos >= len(self.buffer)


# ---------------------------------------------------------------------------
# Moteur audio
# ---------------------------------------------------------------------------

class AudioEngine:
    """
    Moteur audio temps réel pour Omnibasse.
    Thread-safe pour l'accès aux voix depuis le callback sounddevice.
    """

    def __init__(self, samples_dir: Optional[Path] = None) -> None:
        self._samples_dir = samples_dir or SAMPLES_DIR
        # bank_name → {section_index: np.ndarray float32}
        self._bank: dict[int, np.ndarray] = {}
        self._bank_name: str = ""
        self._bank_sample_rate: int = SAMPLE_RATE

        # Voix de polyphonie
        self._voices: list[Voice] = [Voice() for _ in range(NUM_VOICES)]
        self._lock = threading.Lock()

        # Paramètres en temps réel
        self._volume: float = 0.8
        self._filter_cutoff: float = 1.0   # 0.0=200Hz, 1.0=8kHz
        self._reverb_mix: float = 0.0

        # Buffer de reverb simplifié (delay line)
        self._reverb_buffer: np.ndarray = np.zeros(SAMPLE_RATE // 2, dtype=np.float32)
        self._reverb_pos: int = 0

        # Filtre IIR — coefficients recalculés à chaque changement de cutoff
        self._filter_b: Optional[np.ndarray] = None
        self._filter_a: Optional[np.ndarray] = None
        self._filter_state: list[np.ndarray] = []
        self._update_filter()

        # Démarrage du stream sounddevice
        self._stream: Optional[object] = None
        self._start_stream()

    # ------------------------------------------------------------------
    # Chargement des samples
    # ------------------------------------------------------------------

    def load_bank(self, bank_name: str) -> None:
        """
        Charge tous les WAV de samples/<bank_name>/ en RAM numpy float32.
        Les fichiers sont nommés 0.wav à 5.wav (une par section).
        Si le fichier n'existe pas, la section est silencieuse.
        """
        import wave  # stdlib

        bank_path = self._samples_dir / bank_name
        new_bank: dict[int, np.ndarray] = {}

        if not bank_path.exists():
            logger.warning(f"Banque introuvable : {bank_path}. Sons silencieux.")
            self._bank = new_bank
            self._bank_name = bank_name
            return

        for section_idx in range(6):
            wav_path = bank_path / f"{section_idx}.wav"
            if not wav_path.exists():
                logger.debug(f"Sample manquant : {wav_path}")
                continue
            try:
                with wave.open(str(wav_path)) as wf:
                    n_channels = wf.getnchannels()
                    sampwidth = wf.getsampwidth()
                    framerate = wf.getframerate()
                    n_frames = wf.getnframes()
                    raw = wf.readframes(n_frames)

                # Décoder en float32
                if sampwidth == 2:
                    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
                elif sampwidth == 4:
                    pcm = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
                else:
                    pcm = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0

                # Mixdown stéréo → mono
                if n_channels == 2:
                    pcm = pcm.reshape(-1, 2).mean(axis=1)

                # Rééchantillonnage si nécessaire
                if framerate != SAMPLE_RATE and _SCIPY_AVAILABLE:
                    from math import gcd
                    g = gcd(SAMPLE_RATE, framerate)
                    pcm = resample_poly(pcm, SAMPLE_RATE // g, framerate // g).astype(np.float32)
                elif framerate != SAMPLE_RATE:
                    # Rééchantillonnage simple par interpolation linéaire
                    orig_len = len(pcm)
                    new_len = int(orig_len * SAMPLE_RATE / framerate)
                    pcm = np.interp(
                        np.linspace(0, orig_len - 1, new_len),
                        np.arange(orig_len),
                        pcm,
                    ).astype(np.float32)

                new_bank[section_idx] = pcm
                self._bank_sample_rate = SAMPLE_RATE
                logger.info(f"Sample chargé : {wav_path.name} ({len(pcm)} frames)")

            except Exception as exc:
                logger.error(f"Erreur chargement {wav_path}: {exc}")

        with self._lock:
            self._bank = new_bank
            self._bank_name = bank_name

        logger.info(f"Banque '{bank_name}' chargée — {len(new_bank)} samples.")

    # ------------------------------------------------------------------
    # Lecture
    # ------------------------------------------------------------------

    def play(
        self,
        string_id: int,
        section: int,
        pos: float,
        pressure: float,
        target_freq: Optional[float] = None,
        source_freq: Optional[float] = None,
    ) -> None:
        """
        Déclenche la lecture d'un sample pour (string_id, section) avec
        pitch-shift éventuel et vol-stealing si toutes les voix sont occupées.

        :param pos: position interpolée [0.0, 1.0]
        :param pressure: pression [0.0, 1.0] → volume initial
        :param target_freq: fréquence cible pour le pitch-shift (None = pas de shift)
        :param source_freq: fréquence de référence du sample (None = pas de shift)
        """
        with self._lock:
            raw_sample = self._bank.get(section)
            if raw_sample is None:
                return  # Pas de sample pour cette section

            # Pitch-shift par resampling
            if target_freq and source_freq and _SCIPY_AVAILABLE and target_freq != source_freq:
                ratio = source_freq / target_freq  # étirer pour abaisser, compresser pour monter
                from math import gcd
                # Approche entière : on approche le ratio par une fraction simple
                # pour resample_poly
                r_num = int(round(ratio * 1000))
                r_den = 1000
                g = gcd(r_num, r_den)
                buffer = resample_poly(raw_sample, r_den // g, r_num // g).astype(np.float32)
            else:
                buffer = raw_sample.copy()

            # Vol-stealing : trouver une voix libre ou la plus ancienne
            voice = self._find_voice(string_id, section)
            voice.string_id = string_id
            voice.section = section
            voice.buffer = buffer
            voice.pos = 0
            voice.active = True
            voice.start_time = time.time()
            voice.volume = max(0.1, pressure)  # pression → volume

    def _find_voice(self, string_id: int, section: int) -> Voice:
        """
        Trouve une voix disponible (préférence : même corde, sinon la plus ancienne).
        """
        # 1. Voix inactive
        for v in self._voices:
            if not v.active or v.is_done():
                return v
        # 2. Voix de la même corde (re-trigger)
        for v in self._voices:
            if v.string_id == string_id:
                return v
        # 3. Vol-stealing : la voix la plus ancienne
        return min(self._voices, key=lambda v: v.start_time)

    # ------------------------------------------------------------------
    # Paramètres en temps réel
    # ------------------------------------------------------------------

    def set_param(self, param_id: str, value: float) -> None:
        """
        Met à jour un paramètre en temps réel.
        :param param_id: 'volume', 'filter', 'reverb'
        :param value: valeur normalisée [0.0, 1.0]
        """
        if param_id == "volume":
            self._volume = max(0.0, min(1.0, value))
        elif param_id == "filter":
            self._filter_cutoff = max(0.0, min(1.0, value))
            self._update_filter()
        elif param_id == "reverb":
            self._reverb_mix = max(0.0, min(1.0, value))

    # ------------------------------------------------------------------
    # Filtre IIR
    # ------------------------------------------------------------------

    def _update_filter(self) -> None:
        """Recalcule les coefficients du filtre passe-bas butterworth 2nd ordre."""
        if not _SCIPY_AVAILABLE:
            self._filter_b = None
            self._filter_a = None
            return

        cutoff_hz = FILTER_FREQ_MIN + self._filter_cutoff * (FILTER_FREQ_MAX - FILTER_FREQ_MIN)
        nyq = SAMPLE_RATE / 2.0
        normalized = min(cutoff_hz / nyq, 0.99)
        try:
            b, a = butter(2, normalized, btype="low")
            self._filter_b = b
            self._filter_a = a
            # Réinitialiser l'état du filtre
            self._filter_state = [np.zeros(max(len(a), len(b)) - 1, dtype=np.float32)]
        except Exception as exc:
            logger.warning(f"Erreur calcul filtre: {exc}")
            self._filter_b = None
            self._filter_a = None

    def _apply_filter(self, block: np.ndarray) -> np.ndarray:
        """Applique le filtre passe-bas IIR au bloc audio."""
        if not _SCIPY_AVAILABLE or self._filter_b is None or self._filter_a is None:
            return block
        try:
            from scipy.signal import lfilter as _lfilter, lfilter_zi
            if not self._filter_state:
                zi = lfilter_zi(self._filter_b, self._filter_a) * block[0]
                self._filter_state = [zi]
            filtered, self._filter_state[0] = _lfilter(
                self._filter_b, self._filter_a, block, zi=self._filter_state[0]
            )
            return filtered.astype(np.float32)
        except Exception:
            return block

    # ------------------------------------------------------------------
    # Reverb simplifiée (delay avec feedback)
    # ------------------------------------------------------------------

    def _apply_reverb(self, block: np.ndarray) -> np.ndarray:
        """Reverb simplifiée : delay line avec feedback 50%."""
        if self._reverb_mix < 0.01:
            return block

        out = block.copy()
        delay_len = len(self._reverb_buffer)
        for i in range(len(out)):
            delayed = self._reverb_buffer[self._reverb_pos]
            self._reverb_buffer[self._reverb_pos] = out[i] + delayed * 0.5
            out[i] += delayed * self._reverb_mix
            self._reverb_pos = (self._reverb_pos + 1) % delay_len
        return out

    # ------------------------------------------------------------------
    # Callback sounddevice
    # ------------------------------------------------------------------

    def _audio_callback(
        self,
        outdata: np.ndarray,
        frames: int,
        time_info: object,
        status: object,
    ) -> None:
        """Callback sounddevice appelé à chaque bloc audio."""
        if status:
            logger.debug(f"Audio status: {status}")

        mix = np.zeros(frames, dtype=np.float32)

        with self._lock:
            for voice in self._voices:
                if not voice.active or voice.is_done():
                    voice.active = False
                    continue

                end = min(voice.pos + frames, len(voice.buffer))
                chunk = voice.buffer[voice.pos:end]
                n = len(chunk)
                # Envelope de release simple (fondu sortant sur les 1024 derniers frames)
                tail_start = max(0, len(voice.buffer) - 1024)
                if voice.pos >= tail_start:
                    fade_len = len(voice.buffer) - tail_start
                    fade_pos = voice.pos - tail_start
                    fade = np.linspace(1.0, 0.0, fade_len, dtype=np.float32)
                    fade_chunk = fade[fade_pos:fade_pos + n]
                    if len(fade_chunk) == n:
                        chunk = chunk * fade_chunk

                mix[:n] += chunk * voice.volume
                voice.pos = end
                if voice.pos >= len(voice.buffer):
                    voice.active = False

        # Appliquer filtre passe-bas
        mix = self._apply_filter(mix)
        # Appliquer reverb
        mix = self._apply_reverb(mix)
        # Appliquer volume global et anti-clipping (tanh soft-clip)
        mix = np.tanh(mix * self._volume)

        # Sortie stéréo
        outdata[:, 0] = mix
        outdata[:, 1] = mix

    # ------------------------------------------------------------------
    # Démarrage du stream
    # ------------------------------------------------------------------

    def _start_stream(self) -> None:
        """Démarre le stream sounddevice. Dégradation gracieuse si absent."""
        if not _SD_AVAILABLE:
            logger.info("Mode sans sortie audio (sounddevice absent).")
            return
        try:
            self._stream = sd.OutputStream(
                samplerate=SAMPLE_RATE,
                channels=2,
                dtype="float32",
                blocksize=512,
                callback=self._audio_callback,
            )
            self._stream.start()  # type: ignore
            logger.info("Stream audio démarré.")
        except Exception as exc:
            logger.error(f"Impossible de démarrer le stream audio: {exc}")
            self._stream = None

    def close(self) -> None:
        """Arrête proprement le stream audio."""
        if self._stream is not None:
            try:
                self._stream.stop()  # type: ignore
                self._stream.close()  # type: ignore
            except Exception:
                pass
            self._stream = None
