from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
import mediapipe as mp
import cv2
import numpy as np
import os
import urllib.request
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

app = FastAPI(title="Morphe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker.task")

def download_model():
    if not os.path.exists(MODEL_PATH):
        print("Downloading pose model...")
        url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        urllib.request.urlretrieve(url, MODEL_PATH)

def measure_image(img_array: np.ndarray) -> dict:
    download_model()
    h, w = img_array.shape[:2]
    rgb = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(base_options=base_options)
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp_image)
    if not result.pose_landmarks:
        return {"error": "No body detected"}
    lm = result.pose_landmarks[0]
    shoulder_w = abs(lm[11].x - lm[12].x) * w
    hip_w      = abs(lm[23].x - lm[24].x) * w
    torso_h    = abs(lm[0].y - ((lm[23].y + lm[24].y) / 2)) * h
    if torso_h == 0:
        return {"error": "Could not measure torso"}
    return {
        "shoulder_ratio": round(shoulder_w / torso_h, 4),
        "hip_ratio":      round(hip_w / torso_h, 4),
        "waist_ratio":    round((shoulder_w * 0.75) / torso_h, 4),
        "torso_px":       round(torso_h, 1),
    }

class ScoreRequest(BaseModel):
    current: dict
    previous: dict | None = None
    goals: list[str] = []
    first_scan_date: str | None = None
    retake: bool = False

def get_cycle_number(first_scan_date: str | None) -> int:
    """Calculate which 5-day cycle we're on since first scan."""
    if not first_scan_date:
        return 1
    try:
        first = datetime.fromisoformat(first_scan_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        days_since = (now - first).days
        return max(1, (days_since // 5) + 1)
    except:
        return 1

def can_scan_today(last_scan_date: str | None, retake: bool) -> dict:
    """Check if user is allowed to scan today."""
    if not last_scan_date:
        return {"allowed": True, "reason": "first_scan"}
    if retake:
        return {"allowed": True, "reason": "retake"}
    try:
        last = datetime.fromisoformat(last_scan_date.replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        days_since = (now - last).days
        if days_since < 5:
            days_remaining = 5 - days_since
            return {
                "allowed": False,
                "reason": "too_soon",
                "days_remaining": days_remaining,
                "next_scan_in": f"{days_remaining} day{'s' if days_remaining > 1 else ''}",
            }
        return {"allowed": True, "reason": "cycle_complete"}
    except:
        return {"allowed": True, "reason": "error"}

def calculate_score(current: dict, previous: dict | None, goals: list[str]) -> dict:
    if not previous:
        return {
            "score": 50,
            "grade": "yellow",
            "label": "Baseline set",
            "deltas": {},
            "pts_change": 0,
        }

    deltas = {}
    score = 50

    sh_delta = ((current["shoulder_ratio"] - previous["shoulder_ratio"]) / previous["shoulder_ratio"]) * 100
    hip_delta = ((current["hip_ratio"] - previous["hip_ratio"]) / previous["hip_ratio"]) * 100
    waist_delta = ((current["waist_ratio"] - previous["waist_ratio"]) / previous["waist_ratio"]) * 100

    deltas["shoulders"] = round(sh_delta, 2)
    deltas["hips"] = round(hip_delta, 2)
    deltas["waist"] = round(waist_delta, 2)

    if "muscle" in goals or "recomp" in goals:
        score += sh_delta * 8
        score += hip_delta * 10
        score -= waist_delta * 4
    elif "fat" in goals:
        score -= waist_delta * 12
        score += sh_delta * 4
    elif "posture" in goals:
        score += sh_delta * 5
        score += hip_delta * 5
    else:
        score += sh_delta * 6
        score += hip_delta * 8
        score -= waist_delta * 5

    score = max(0, min(100, round(score)))

    if score >= 80:
        grade, label = "green", "Crushing it"
    elif score >= 60:
        grade, label = "yellow", "Steady progress"
    elif score >= 40:
        grade, label = "orange", "Slow week"
    else:
        grade, label = "red", "Needs a push"

    return {
        "score": score,
        "grade": grade,
        "label": label,
        "deltas": deltas,
        "pts_change": round(score - 50),
    }

@app.get("/")
def root():
    return {"status": "Morphe is alive"}

@app.post("/scan")
async def scan(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        measurements = measure_image(img)
        if "error" in measurements:
            raise HTTPException(status_code=422, detail=measurements["error"])
        return {"success": True, "measurements": measurements}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/score")
async def score(req: ScoreRequest):
    try:
        result = calculate_score(req.current, req.previous, req.goals)
        result["cycle_number"] = get_cycle_number(req.first_scan_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ScanCheckRequest(BaseModel):
    last_scan_date: str | None = None
    retake: bool = False

@app.post("/can-scan")
async def check_can_scan(req: ScanCheckRequest):
    return can_scan_today(req.last_scan_date, req.retake)