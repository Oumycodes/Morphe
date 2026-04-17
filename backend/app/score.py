"""Goal-based progress scoring with noise dampening.

Computes a 0-100 score measuring progress toward the user's stated goal,
using signed deltas against the baseline (first) scan. Includes:
- Higher noise threshold (2.5%) to filter CV measurement variance
- Score dampening (70% new / 30% previous) for stability
- Max ±15 point swing per cycle
- Wrong-direction penalties
"""
from typing import Optional

MUSCLE_TO_KEY = {
    "shoulders": "shoulder_ratio",
    "hips": "hip_ratio",
    "glutes": "glute_projection_ratio",
}

NOISE_THRESHOLD = 2.5  # % — higher than before to filter CV noise
MAX_SWING = 15         # max score change per cycle


def _pct_delta(cur, base):
    if cur is None or base is None or base == 0:
        return 0.0
    return ((cur - base) / base) * 100.0


def _clamp(v, lo=0.0, hi=100.0):
    return max(lo, min(hi, v))


def _smooth_measurements(current, previous):
    """Average current with previous to reduce single-scan noise."""
    if not previous:
        return current
    smoothed = {}
    for key in current:
        cur_v = current.get(key)
        prev_v = previous.get(key)
        if cur_v is not None and prev_v is not None and isinstance(cur_v, (int, float)) and isinstance(prev_v, (int, float)):
            smoothed[key] = cur_v * 0.7 + prev_v * 0.3
        else:
            smoothed[key] = cur_v
    return smoothed


def _fat_component(current, baseline, target_pct):
    """Waist reduction progress. Waist DOWN = positive progress."""
    if not target_pct or target_pct <= 0:
        target_pct = 5.0
    waist_delta = _pct_delta(current.get("waist_ratio"), baseline.get("waist_ratio"))
    if abs(waist_delta) < NOISE_THRESHOLD:
        waist_delta = 0.0
    progress = (-waist_delta / target_pct) * 100.0
    return _clamp(progress)


def _muscle_component(current, baseline, target_muscles, target_pct):
    """Avg progress across target muscles only."""
    if not target_muscles:
        return 50.0
    if not target_pct or target_pct <= 0:
        target_pct = 4.0
    scores = []
    for m in target_muscles:
        key = MUSCLE_TO_KEY.get(m)
        if not key:
            continue
        delta = _pct_delta(current.get(key), baseline.get(key))
        if abs(delta) < NOISE_THRESHOLD:
            delta = 0.0
        scores.append(_clamp((delta / target_pct) * 100.0))
    return sum(scores) / len(scores) if scores else 50.0


def compute_progress_score(
    current: dict,
    baseline: Optional[dict],
    previous: Optional[dict],
    goal: dict,
    previous_score: Optional[int] = None,
) -> dict:
    """Main scoring entry point.

    current:        latest scan measurements
    baseline:       first scan (reference point)
    previous:       most recent prior scan (for smoothing + week-over-week delta)
    goal:           UserGoal dict from profile
    previous_score: last cycle's score (for dampening)
    """
    if not baseline:
        return {
            "score": None, "grade": None, "label": "Baseline set",
            "fat_component": None, "muscle_component": None,
            "deltas_vs_baseline": {}, "deltas_vs_previous": {},
        }

    # Smooth current measurements with previous to reduce noise
    smoothed = _smooth_measurements(current, previous)

    goal_type = goal.get("type", "recomposition")
    target_muscles = goal.get("target_muscles") or []
    target_fat_pct = goal.get("target_fat_loss_pct", 5.0)
    target_muscle_pct = goal.get("target_muscle_gain_pct", 4.0)
    weights = goal.get("weights") or {"fat": 0.5, "muscle": 0.5}

    fat_c = None
    muscle_c = None

    if goal_type == "fat_loss":
        fat_c = _fat_component(smoothed, baseline, target_fat_pct)
        raw_score = fat_c
    elif goal_type == "muscle_gain":
        muscle_c = _muscle_component(smoothed, baseline, target_muscles, target_muscle_pct)
        raw_score = muscle_c
    else:  # recomposition
        fat_c = _fat_component(smoothed, baseline, target_fat_pct)
        muscle_c = _muscle_component(smoothed, baseline, target_muscles, target_muscle_pct)
        w_fat = weights.get("fat", 0.5)
        w_mus = weights.get("muscle", 0.5)
        total = (w_fat + w_mus) or 1.0
        raw_score = (fat_c * w_fat + muscle_c * w_mus) / total

    # Wrong-direction penalties (reduced from before)
    waist_delta_base = _pct_delta(smoothed.get("waist_ratio"), baseline.get("waist_ratio"))
    shoulder_delta_base = _pct_delta(smoothed.get("shoulder_ratio"), baseline.get("shoulder_ratio"))

    if goal_type == "muscle_gain" and waist_delta_base > 4.0:
        raw_score -= min(10, (waist_delta_base - 4.0) * 2)
    if goal_type == "fat_loss" and shoulder_delta_base < -4.0:
        raw_score -= min(10, abs(shoulder_delta_base + 4.0) * 2)

    raw_score = _clamp(raw_score)

    # Dampen: blend with previous score (70% new, 30% old)
    if previous_score is not None:
        dampened = raw_score * 0.7 + previous_score * 0.3
        # Cap the swing to ±MAX_SWING points
        diff = dampened - previous_score
        if abs(diff) > MAX_SWING:
            dampened = previous_score + (MAX_SWING if diff > 0 else -MAX_SWING)
        score = int(round(_clamp(dampened)))
    else:
        score = int(round(raw_score))

    # Deltas for display
    deltas_base, deltas_prev = {}, {}
    tracked = {**MUSCLE_TO_KEY, "waist": "waist_ratio"}
    for muscle, key in tracked.items():
        d_base = _pct_delta(smoothed.get(key), baseline.get(key))
        if abs(d_base) > NOISE_THRESHOLD:
            deltas_base[muscle] = round(d_base, 2)
        if previous:
            d_prev = _pct_delta(smoothed.get(key), previous.get(key))
            if abs(d_prev) > NOISE_THRESHOLD:
                deltas_prev[muscle] = round(d_prev, 2)

    if score >= 80:   grade, label = "green",  "Crushing it"
    elif score >= 60: grade, label = "yellow", "Steady progress"
    elif score >= 40: grade, label = "orange", "Slow week"
    else:             grade, label = "red",    "Needs a push"

    return {
        "score": score, "grade": grade, "label": label,
        "fat_component": round(fat_c, 1) if fat_c is not None else None,
        "muscle_component": round(muscle_c, 1) if muscle_c is not None else None,
        "deltas_vs_baseline": deltas_base, "deltas_vs_previous": deltas_prev,
    }