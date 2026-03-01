"""
Generate a synthetic cohort of 1,000 students using a grade-first,
holistic-tiering approach.

Each student is assigned a letter grade first, then ALL behavioural metrics
are drawn from Gaussian distributions whose means are calibrated to that
grade tier. This creates a strong multivariate correlation so the ML models
learn that sleep, attention, and focus impact grades just as heavily as raw
study hours.

Grade distribution: 15% A · 35% B · 35% C · 15% D/F

Run standalone (from the scholar_vision root):
    python scripts/generate_mock_cohort.py
"""

import random

import numpy as np
import pandas as pd
from pathlib import Path

# Tier parameters
# Each tier defines (mean, std) for every feature, plus the numeric grade range.
# D/F sleep is bimodal: 50% sleep-deprived (<5.5 h), 50% oversleeping (>9.5 h).

TIERS = {
    "A": {
        "weight":      0.15,
        "study":       (5, 0.8),    # h/day
        "attention":   (75,  10),     # min
        "focus":       (70,  5),      # %
        "sleep":       (8.0, 0.5),    # h/night
        "breaks":      (1.0, 0.5),    # per session
        "grade":       (88,  4),      # numeric score
        "grade_lo":    80,
        "grade_hi":    100,
    },
    "B": {
        "weight":      0.35,
        "study":       (4.5, 0.8),
        "attention":   (50,  10),
        "focus":       (50,  8),
        "sleep":       (7.0, 0.7),
        "breaks":      (2.0, 0.7),
        "grade":       (76,  4),
        "grade_lo":    65,
        "grade_hi":    79,
    },
    "C": {
        "weight":      0.35,
        "study":       (3.0, 0.8),
        "attention":   (35,  10),
        "focus":       (30,  8),
        "sleep":       (6.0, 0.8),
        "breaks":      (3.0, 0.8),
        "grade":       (63,  4),
        "grade_lo":    50,
        "grade_hi":    64,
    },
    "DF": {
        "weight":      0.15,          # fills remainder
        "study":       (1.5, 0.8),
        "attention":   (15,  7),
        "focus":       (10,  10),
        # sleep: bimodal — half deprived (~4h), half oversleeping (~11h)
        "sleep_low":   (4.0, 0.7),   # deprived branch
        "sleep_high":  (10.5, 0.8),  # oversleeping branch
        "breaks":      (4.5, 1.2),
        "grade":       (42,  6),
        "grade_lo":    0,
        "grade_hi":    49,
    },
}

def generate(n: int = 1_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # Compute per-tier student counts
    n_A  = int(n * TIERS["A"]["weight"])
    n_B  = int(n * TIERS["B"]["weight"])
    n_C  = int(n * TIERS["C"]["weight"])
    n_DF = n - n_A - n_B - n_C           # absorbs rounding remainder

    counts = [("A", n_A), ("B", n_B), ("C", n_C), ("DF", n_DF)]

    segments: list[pd.DataFrame] = []

    for tier_key, n_tier in counts:
        p = TIERS[tier_key]

        study = np.clip(
            rng.normal(p["study"][0], p["study"][1], n_tier), 0, 16
        ).round(1)

        attention = np.clip(
            rng.normal(p["attention"][0], p["attention"][1], n_tier), 5, 120
        ).round(0)

        focus = np.clip(
            rng.normal(p["focus"][0], p["focus"][1], n_tier), 0, 100
        ).round(1)

        # D/F sleep: bimodal — 50% deprived, 50% oversleeping
        if tier_key == "DF":
            coin  = rng.random(n_tier) < 0.5
            sleep = np.where(
                coin,
                np.clip(rng.normal(p["sleep_low"][0],  p["sleep_low"][1],  n_tier), 3.0,  5.5),
                np.clip(rng.normal(p["sleep_high"][0], p["sleep_high"][1], n_tier), 9.5, 12.0),
            ).round(1)
        else:
            sleep = np.clip(
                rng.normal(p["sleep"][0], p["sleep"][1], n_tier), 3, 12
            ).round(1)

        breaks = np.clip(
            rng.normal(p["breaks"][0], p["breaks"][1], n_tier), 0, 10
        ).round(1)

        grade = np.clip(
            rng.normal(p["grade"][0], p["grade"][1], n_tier),
            p["grade_lo"], p["grade_hi"],
        ).round(1)

        segments.append(pd.DataFrame({
            "studyHours":    study,
            "attentionSpan": attention,
            "focusRatio":    focus,
            "sleepHours":    sleep,
            "breakFreq":     breaks,
            "currentGrade":  grade,
        }))

    df = pd.concat(segments, ignore_index=True)
    # Shuffle so tiers aren't block-ordered in the DB
    df = df.sample(frac=1, random_state=seed).reset_index(drop=True)
    return df

if __name__ == "__main__":
    out = Path(__file__).parent.parent / "mock_cohort_data.csv"
    df = generate()
    df.to_csv(out, index=False)
    print(f"Saved {len(df)} rows → {out}")
    print(df.describe().round(2))
    print("\nGrade distribution (approx letter tiers):")
    bins   = [0, 50, 65, 80, 101]
    labels = ["D/F (<50)", "C (50-64)", "B (65-79)", "A (80-100)"]
    print(pd.cut(df["currentGrade"], bins=bins, labels=labels).value_counts().sort_index())
