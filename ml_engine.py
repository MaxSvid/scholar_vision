"""
ML inference engine for ScholarVision academic prediction.

Trains three models on a synthetic student cohort and exposes helper
functions for three analysis modes:
  - strict : Decision Tree path → IF/THEN rule explanation
  - peer   : K-Nearest Neighbours → comparison with similar students
  - deep   : Random Forest + SHAP → feature attribution breakdown

Models are trained once and persisted to /models via joblib.
"""

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor

log = logging.getLogger(__name__)

FEATURES = ["studyHours", "attentionSpan", "focusRatio", "sleepHours", "breakFreq"]
TARGET   = "currentGrade"

FEATURE_LABELS = {
    "studyHours":    "Daily study hours",
    "attentionSpan": "Attention span",
    "focusRatio":    "Focus ratio",
    "sleepHours":    "Sleep hours",
    "breakFreq":     "Breaks / day",
}
FEATURE_UNITS = {
    "studyHours":    "h",
    "attentionSpan": "min",
    "focusRatio":    "%",
    "sleepHours":    "h",
    "breakFreq":     "",
}

MODELS_DIR = Path("models")
CSV_PATH   = Path("mock_cohort_data.csv")


# ─── Data generation (inline, mirrors scripts/generate_mock_cohort.py) ────────

def _generate_data(n: int = 1_000, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    studyHours    = np.clip(rng.normal(5.5, 3.0, n), 0, 16).round(1)
    sleepHours    = np.clip(rng.normal(7.2, 1.4, n), 3, 12).round(1)
    breakFreq     = np.clip(rng.normal(3.0, 2.0, n), 0, 10).round(1)
    focusRatio    = np.clip(studyHours * 4.8 + rng.normal(26, 18, n), 0, 100).round(1)
    attentionSpan = np.clip(focusRatio * 0.55 + sleepHours * 3.8 + rng.normal(12, 20, n), 5, 120).round(0)
    # Focus ratio is the highest influence (0.8 weight), with progressive sleep penalty for low sleep
    sleep_penalty = np.maximum(0, 7 - sleepHours) * 3.5  # Drastic penalty for sleep < 7h
    currentGrade  = np.clip(
        studyHours * 2.5 + attentionSpan * 0.15 + focusRatio * 0.8
        + sleepHours * 1.8 + breakFreq * 0.5
        - sleep_penalty
        + rng.normal(0, 8, n) - 15,
        0, 100,
    ).round(1)
    return pd.DataFrame({
        "studyHours": studyHours, "attentionSpan": attentionSpan,
        "focusRatio": focusRatio, "sleepHours": sleepHours,
        "breakFreq": breakFreq,   "currentGrade": currentGrade,
    })


# ─── Engine ───────────────────────────────────────────────────────────────────

class MLEngine:
    def __init__(self):
        self.dt:       DecisionTreeRegressor  | None = None
        self.knn:      NearestNeighbors       | None = None
        self.rf:       RandomForestRegressor  | None = None
        self.scaler:   StandardScaler         | None = None
        self.train_df: pd.DataFrame           | None = None

    # ── Lifecycle ─────────────────────────────────────────────────

    def ensure_ready(self):
        MODELS_DIR.mkdir(exist_ok=True)
        if self._models_exist():
            log.info("Loading persisted models from %s", MODELS_DIR)
            self._load()
        else:
            log.info("No persisted models found — training now…")
            self._train_and_save()
            log.info("Models trained and saved to %s", MODELS_DIR)

    def _models_exist(self) -> bool:
        return (
            (MODELS_DIR / "dt.joblib").exists()  and
            (MODELS_DIR / "knn.joblib").exists() and
            (MODELS_DIR / "rf.joblib").exists()
        )

    def _get_data(self) -> pd.DataFrame:
        if CSV_PATH.exists():
            log.info("Loading cohort data from %s", CSV_PATH)
            return pd.read_csv(CSV_PATH)
        log.info("No CSV found — generating synthetic cohort…")
        df = _generate_data()
        df.to_csv(CSV_PATH, index=False)
        return df

    # ── Training ──────────────────────────────────────────────────

    def _train_and_save(self):
        df = self._get_data()
        X  = df[FEATURES].values
        y  = df[TARGET].values

        self.scaler = StandardScaler()
        X_scaled    = self.scaler.fit_transform(X)

        self.dt = DecisionTreeRegressor(max_depth=3, random_state=42)
        self.dt.fit(X, y)

        self.knn = NearestNeighbors(n_neighbors=5, metric="euclidean")
        self.knn.fit(X_scaled)

        self.rf = RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1)
        self.rf.fit(X, y)

        self.train_df = df

        joblib.dump(self.dt,                      MODELS_DIR / "dt.joblib")
        joblib.dump((self.knn, self.scaler),       MODELS_DIR / "knn.joblib")
        joblib.dump(self.rf,                       MODELS_DIR / "rf.joblib")
        df.to_csv(MODELS_DIR / "train_data.csv",  index=False)

    # ── Loading ───────────────────────────────────────────────────

    def _load(self):
        self.dt                = joblib.load(MODELS_DIR / "dt.joblib")
        self.knn, self.scaler  = joblib.load(MODELS_DIR / "knn.joblib")
        self.rf                = joblib.load(MODELS_DIR / "rf.joblib")
        self.train_df          = pd.read_csv(MODELS_DIR / "train_data.csv")

    # ── Helpers ───────────────────────────────────────────────────

    def _X(self, values: dict) -> np.ndarray:
        return np.array([[values[f] for f in FEATURES]])

    def _score_to_grade(self, score: float) -> str:
        s = round(score)
        if s >= 90: return "A+"
        if s >= 80: return "A"
        if s >= 70: return "B"
        if s >= 60: return "C"
        if s >= 50: return "D"
        return "F"

    def _bar(self, v: float, max_v: float, width: int = 12) -> str:
        filled = round(abs(v) / max_v * width) if max_v else 0
        return "█" * filled

    # ── Inference ─────────────────────────────────────────────────

    def predict_strict(self, values: dict) -> tuple[float, str]:
        """Decision Tree → tree path → IF/THEN rules."""
        X      = self._X(values)
        score  = float(np.clip(self.dt.predict(X)[0], 0, 100))
        tree   = self.dt.tree_

        node_indicator = self.dt.decision_path(X)
        leaf_id        = self.dt.apply(X)[0]
        node_ids       = node_indicator.indices[
            node_indicator.indptr[0]: node_indicator.indptr[1]
        ]

        lines = ["DECISION PATH:\n"]
        for step, node_id in enumerate(node_ids, 1):
            if node_id == leaf_id:
                break
            feat  = FEATURES[tree.feature[node_id]]
            label = FEATURE_LABELS[feat]
            unit  = FEATURE_UNITS[feat]
            thr   = tree.threshold[node_id]
            val   = values[feat]
            op    = "≤" if val <= thr else ">"
            arrow = "→ lower range" if val <= thr else "→ higher range"
            lines.append(
                f"  [{step}] {label} = {val}{unit} {op} {thr:.1f}{unit}  {arrow}"
            )

        grade  = self._score_to_grade(score)
        trend  = (
            "↑ ON TRACK — EXCELLENT TRAJECTORY" if score >= 80 else
            "→ STABLE — ROOM TO IMPROVE"         if score >= 65 else
            "↓ AT RISK — INTERVENTION REQUIRED"
        )
        lines.append(f"\nPREDICTED SCORE:  {score:.0f} / 100  [{grade}]")
        lines.append(f"TRAJECTORY:  {trend}\n")

        tips = []
        if values["studyHours"]    < 4:   tips.append(f"Study hours ({values['studyHours']}h) are below 4h — the highest-leverage change available.")
        if values["attentionSpan"] < 40:  tips.append(f"Attention span ({values['attentionSpan']}min) is below 40min — try Pomodoro 45/15 splits.")
        if values["focusRatio"]    < 60:  tips.append(f"Focus ratio ({values['focusRatio']}%) is below 60% — reduce distracting app usage.")
        if values["sleepHours"]    < 7:   tips.append(f"Sleep ({values['sleepHours']}h) is below 7h — memory consolidation is impaired.")
        if values["breakFreq"]     < 2:   tips.append(f"Only {values['breakFreq']} breaks/day — structured breaks reduce cognitive fatigue.")

        if tips:
            lines.append("IMPROVEMENT LEVERS:")
            for t in tips: lines.append(f"  → {t}")
        else:
            lines.append("→ OPTIMAL PARAMETERS DETECTED. MAINTAIN CURRENT TRAJECTORY.")

        return score, "\n".join(lines)

    def predict_peer(self, values: dict) -> tuple[float, str]:
        """KNN → top-5 neighbours → comparison with similar students."""
        X        = self._X(values)
        X_scaled = self.scaler.transform(X)

        _, indices     = self.knn.kneighbors(X_scaled)
        neighbours     = self.train_df.iloc[indices[0]]
        peer_avg       = neighbours[FEATURES + [TARGET]].mean()
        peer_grade_avg = float(peer_avg[TARGET])
        my_score       = float(np.clip(self.rf.predict(X)[0], 0, 100))

        lines = ["YOUR 5 CLOSEST PEERS (by study profile):\n"]
        for feat in FEATURES:
            label  = FEATURE_LABELS[feat]
            unit   = FEATURE_UNITS[feat]
            mine   = values[feat]
            avg    = peer_avg[feat]
            delta  = mine - avg
            arrow  = f"↑ +{delta:.1f}" if delta > 0.1 else f"↓ {delta:.1f}" if delta < -0.1 else "≈"
            lines.append(
                f"  {label:<22} peer avg: {avg:.1f}{unit:<4}   you: {mine}{unit:<4}   {arrow}"
            )

        lines.append(f"\n  Peer avg grade:  {peer_grade_avg:.0f}/100")
        lines.append(f"  Your prediction: {my_score:.0f}/100\n")

        gaps = sorted(
            [(f, peer_avg[f] - values[f]) for f in FEATURES if peer_avg[f] - values[f] > 0.5],
            key=lambda x: -x[1],
        )
        if gaps:
            lines.append("BIGGEST GAPS TO CLOSE:")
            for feat, diff in gaps[:3]:
                label = FEATURE_LABELS[feat]
                unit  = FEATURE_UNITS[feat]
                lines.append(f"  → {label}: +{diff:.1f}{unit} would align you with peer average")
        else:
            lines.append("→ You are already at or above your peer group's average on all metrics.")

        return my_score, "\n".join(lines)

    def predict_deep(self, values: dict) -> tuple[float, str, list[dict]]:
        """Random Forest + SHAP → feature attribution breakdown."""
        X     = self._X(values)
        score = float(np.clip(self.rf.predict(X)[0], 0, 100))

        explainer   = shap.TreeExplainer(self.rf)
        shap_values = explainer.shap_values(X)[0]   # shape (n_features,)
        shap_map    = dict(zip(FEATURES, shap_values))

        sorted_shap  = sorted(shap_map.items(), key=lambda x: x[1])
        worst        = sorted_shap[0]
        best         = sorted_shap[-1]
        max_abs      = max(abs(v) for v in shap_values) or 1.0

        lines = ["SHAP FEATURE ATTRIBUTION — WHAT DRIVES YOUR SCORE:\n"]

        lines.append(
            f"  TOP POSITIVE FACTOR:  {FEATURE_LABELS[best[0]]}  "
            f"( +{best[1]:.1f} pts )"
        )
        lines.append(
            f"  TOP NEGATIVE FACTOR:  {FEATURE_LABELS[worst[0]]}  "
            f"( {worst[1]:.1f} pts )\n"
        )

        lines.append("  FULL BREAKDOWN:")
        for feat, sv in sorted(shap_map.items(), key=lambda x: -x[1]):
            label  = FEATURE_LABELS[feat]
            unit   = FEATURE_UNITS[feat]
            val    = values[feat]
            sign   = "+" if sv >= 0 else ""
            bar    = self._bar(sv, max_abs)
            lines.append(
                f"  {label:<22} {val}{unit:<5}  {sign}{sv:+.1f} pts  {bar}"
            )

        lines.append(f"\nPREDICTED SCORE:  {score:.0f} / 100  [{self._score_to_grade(score)}]\n")

        if abs(worst[1]) > 2:
            feat  = worst[0]
            label = FEATURE_LABELS[feat]
            unit  = FEATURE_UNITS[feat]
            lines.append(
                f"HIGHEST IMPACT ACTION:\n"
                f"  → Improving {label.lower()} is currently costing you "
                f"~{abs(worst[1]):.1f} pts. Address this first."
            )

        # Structured SHAP data — sorted by absolute impact descending
        shap_structured = [
            {
                "feature_key":   feat,
                "metric_name":   FEATURE_LABELS[feat],
                "unit":          FEATURE_UNITS[feat],
                "value":         values[feat],
                "impact_score":  round(float(sv), 2),
            }
            for feat, sv in sorted(shap_map.items(), key=lambda x: -abs(x[1]))
        ]

        return score, "\n".join(lines), shap_structured


    async def load_cohort_from_db(self) -> None:
        """
        Replace self.train_df with live data from the cohort_students table.
        Called from the FastAPI lifespan after ensure_ready().
        Falls back silently to the CSV-based DataFrame if the DB is unavailable.
        """
        from database.cohort import async_fetch_cohort_df
        df = await async_fetch_cohort_df()
        if df is not None and len(df) > 0:
            self.train_df = df
            log.info("Peer mode: using %d cohort rows from DB.", len(df))
        else:
            log.info("Peer mode: using %d cohort rows from CSV fallback.", len(self.train_df) if self.train_df is not None else 0)


# ─── Singleton ────────────────────────────────────────────────────────────────

engine = MLEngine()
