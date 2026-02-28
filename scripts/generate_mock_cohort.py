"""
Generate a synthetic cohort of 1,000 students with realistic correlations
between study habits and academic grade.

Run from the scholar_vision root:
    python scripts/generate_mock_cohort.py

Outputs mock_cohort_data.csv in the current directory.
"""

import numpy as np
import pandas as pd
from pathlib import Path


def generate(n: int = 1_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # ── Primary behavioural features ─────────────────────────────
    # studyHours: skewed right — most students 2-8h, few at extremes
    studyHours = np.clip(rng.normal(5.5, 3.0, n), 0, 16).round(1)

    # sleepHours: roughly normal around 7h
    sleepHours = np.clip(rng.normal(7.2, 1.4, n), 3, 12).round(1)

    # breakFreq: 0-10 breaks per study day
    breakFreq = np.clip(rng.normal(3.0, 2.0, n), 0, 10).round(1)

    # focusRatio: correlated with studyHours (dedicated students focus more)
    focusRatio = np.clip(
        studyHours * 4.8 + rng.normal(26, 18, n), 0, 100
    ).round(1)

    # attentionSpan: correlated with focusRatio and sleep quality
    attentionSpan = np.clip(
        focusRatio * 0.55 + sleepHours * 3.8 + rng.normal(12, 20, n), 5, 120
    ).round(0)

    # ── Target: currentGrade ─────────────────────────────────────
    # Weighted linear combination with realistic noise
    currentGrade = np.clip(
        studyHours    * 3.2    +   # study time: highest lever
        attentionSpan * 0.18   +   # sustained focus
        focusRatio    * 0.28   +   # productive vs distracting ratio
        sleepHours    * 2.2    +   # sleep for memory consolidation
        breakFreq     * 0.6    +   # structured breaks help
        rng.normal(0, 8, n)    -   # realistic noise (~±8 pts)
        15,                        # baseline offset
        0, 100,
    ).round(1)

    return pd.DataFrame({
        "studyHours":    studyHours,
        "attentionSpan": attentionSpan,
        "focusRatio":    focusRatio,
        "sleepHours":    sleepHours,
        "breakFreq":     breakFreq,
        "currentGrade":  currentGrade,
    })


if __name__ == "__main__":
    out = Path(__file__).parent.parent / "mock_cohort_data.csv"
    df = generate()
    df.to_csv(out, index=False)
    print(f"Saved {len(df)} rows → {out}")
    print(df.describe().round(2))
