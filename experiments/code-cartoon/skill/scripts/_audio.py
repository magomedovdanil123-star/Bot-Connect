"""Shared audio helpers: decode any file with ffmpeg, onset strength, simple loudness.

Used by synth_audio.py (tracks, voice lines), beats.py (tempo and beats), voice.py (durations)
and analyze_reference.py (hits in a reference video). Needs ffmpeg on PATH + numpy + scipy.
"""
import subprocess

import numpy as np


def load_audio(path, sr=48000, channels=2):
    """Decode any audio/video file to float64 samples, shape (n, channels) or (n,) for mono."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-vn",
                        "-f", "f32le", "-ac", str(channels), "-ar", str(sr), "-"], capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(f"ffmpeg could not decode {path}: {p.stderr.decode(errors='replace')[:300]}")
    x = np.frombuffer(p.stdout, dtype="<f4").astype(np.float64)
    return x if channels == 1 else x.reshape(-1, channels)


def duration(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return 0.0


def stft_mag(x, n_fft=2048, hop=512):
    """magnitude spectrogram, frames x bins (Hann window)"""
    if len(x) < n_fft:
        x = np.pad(x, (0, n_fft - len(x)))
    n = 1 + (len(x) - n_fft) // hop
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n)[:, None]
    return np.abs(np.fft.rfft(x[idx] * np.hanning(n_fft)[None, :], axis=1))


def onset_strength(x, sr, n_fft=2048, hop=512, band=None):
    """spectral flux of the log spectrum, local-mean removed, half-wave rectified, peak-normalised.
    band=(lo_hz, hi_hz) restricts it (e.g. (30, 160) for kick drums). Returns (env, frame_times)."""
    S = np.log1p(100 * stft_mag(x, n_fft, hop))
    if band:
        f = np.fft.rfftfreq(n_fft, 1 / sr)
        S = S[:, (f >= band[0]) & (f <= band[1])]
    flux = np.maximum(0, np.diff(S, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    k = max(1, int(round(0.5 * sr / hop)))  # remove the slow trend (~0.5 s)
    trend = np.convolve(flux, np.ones(k) / k, mode="same")
    env = np.maximum(0, flux - trend)
    env /= env.max() + 1e-12
    return env, np.arange(len(env)) * hop / sr


def rms_db(x, sr, win=0.5, hop=None):
    """RMS level in dB over windows (default 0.5 s, hop = win/2). Returns (db, times)."""
    w = int(win * sr)
    h = int((hop or win / 2) * sr)
    n = max(1, 1 + (len(x) - w) // h)
    out = np.array([np.sqrt(np.mean(x[i * h:i * h + w] ** 2) + 1e-12) for i in range(n)])
    return 20 * np.log10(out + 1e-9), np.arange(n) * h / sr + win / 2
