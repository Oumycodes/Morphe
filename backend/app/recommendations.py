"""Per-muscle analysis + AI narration of scan results."""
import os
from typing import Optional
import requests as http_requests

from score import MUSCLE_TO_KEY, NOISE_THRESHOLD

OPENAI_KEY = ''.join(c for c in os.environ.get("OPENAI_API_KEY", "") if ord(c) < 128).strip()

TRACKED = ["shoulders", "hips", "glutes", "waist"]
KEY_MAP = {**MUSCLE_TO_KEY, "waist": "waist_ratio"}


def _classify(delta_pct: float, is_target: bool, goal_type: str, muscle: str) -> str:
    if abs(delta_pct) < NOISE_THRESHOLD:
        return "flat"
    if muscle == "waist":
        if goal_type in ("fat_loss", "recomposition"):
            return "on_track" if delta_pct < 0 else "wrong_direction"
        return "stable" if abs(delta_pct) < 3 else "drift"
    # muscle groups
    if goal_type == "fat_loss":
        return "preserved" if delta_pct > -2 else "losing_muscle"
    # muscle_gain or recomposition
    if delta_pct > 0:
        return "gaining" if is_target else "bonus_gain"
    return "shrinking" if is_target else "slight_loss"


def build_muscle_reports(
    current: dict,
    baseline: Optional[dict],
    previous: Optional[dict],
    goal: dict,
) -> list[dict]:
    """One structured report per tracked muscle."""
    if not baseline:
        return []
    goal_type = goal.get("type", "recomposition")
    targets = set(goal.get("target_muscles") or [])
    reports = []
    for muscle in TRACKED:
        key = KEY_MAP[muscle]
        cur_v = current.get(key)
        base_v = baseline.get(key)
        if cur_v is None or base_v is None or base_v == 0:
            continue
        d_base = ((cur_v - base_v) / base_v) * 100.0
        d_prev = None
        if previous and previous.get(key):
            d_prev = ((cur_v - previous[key]) / previous[key]) * 100.0
        is_target = muscle in targets
        reports.append({
            "muscle": muscle,
            "is_target": is_target,
            "status": _classify(d_base, is_target, goal_type, muscle),
            "delta_vs_baseline_pct": round(d_base, 2),
            "delta_vs_previous_pct": round(d_prev, 2) if d_prev is not None else None,
            "current": round(cur_v, 4),
            "baseline": round(base_v, 4),
        })
    return reports


def detect_asymmetry(measurements: dict) -> Optional[dict]:
    """Left/right asymmetry — only runs if CV outputs per-side values."""
    left = measurements.get("left_shoulder_px")
    right = measurements.get("right_shoulder_px")
    if left is None or right is None or max(left, right) == 0:
        return None
    diff_pct = abs(left - right) / max(left, right) * 100
    if diff_pct < 3.0:
        return None
    dominant = "left" if left > right else "right"
    return {
        "area": "shoulders",
        "dominant_side": dominant,
        "difference_pct": round(diff_pct, 1),
        "message": f"Your {dominant} shoulder is {diff_pct:.1f}% larger — worth balancing.",
    }


def narrate_reports(reports: list[dict], goal: dict, score: Optional[int]) -> str:
    """Turn structured reports into a friendly 3–4 sentence analysis via GPT-4o-mini."""
    if not OPENAI_KEY or not reports or score is None:
        return ""
    try:
        goal_type = goal.get("type", "general fitness")
        targets = goal.get("target_muscles") or []
        lines = []
        for r in reports:
            tag = " [TARGET]" if r["is_target"] else ""
            lines.append(
                f"- {r['muscle']}{tag}: {r['status']} "
                f"({r['delta_vs_baseline_pct']:+.1f}% vs baseline)"
            )
        prompt = (
            f"User goal: {goal_type}. Target muscles: {', '.join(targets) or 'none'}. "
            f"Progress score: {score}/100.\n"
            f"Scan data:\n" + "\n".join(lines) + "\n\n"
            "Write a 3-4 sentence analysis: what they did well this week, what the "
            "data shows, and ONE specific recommendation to reach their goal next "
            "week. Be direct and specific. No fluff, no emojis."
        )
        payload = {
            "model": "gpt-4o-mini",
            "max_tokens": 220,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        }
        r = http_requests.post(
            "https://api.openai.com/v1/chat/completions",
            json=payload, headers=headers, timeout=15,
        )
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"narrate_reports error: {e}")
    return ""
