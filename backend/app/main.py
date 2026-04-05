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
SEG_MODEL_PATH = os.path.join(os.path.dirname(__file__), "selfie_multiclass.tflite")

def download_model():
    if not os.path.exists(MODEL_PATH):
        print("Downloading pose model...")
        url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        urllib.request.urlretrieve(url, MODEL_PATH)

def download_seg_model():
    if not os.path.exists(SEG_MODEL_PATH):
        print("Downloading segmentation model...")
        url = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite"
        urllib.request.urlretrieve(url, SEG_MODEL_PATH)

def get_landmarks(img_array: np.ndarray):
    download_model()
    h, w = img_array.shape[:2]
    rgb = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(base_options=base_options)
    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp_image)
    if not result.pose_landmarks:
        return None, h, w
    return result.pose_landmarks[0], h, w

def get_body_mask(img_array: np.ndarray) -> np.ndarray | None:
    download_seg_model()
    h, w = img_array.shape[:2]
    rgb = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    base_options = python.BaseOptions(model_asset_path=SEG_MODEL_PATH)
    options = vision.ImageSegmenterOptions(
        base_options=base_options,
        output_category_mask=True,
    )
    with vision.ImageSegmenter.create_from_options(options) as segmenter:
        result = segmenter.segment(mp_image)
    if not result.category_mask:
        return None
    mask = result.category_mask.numpy_view()
    # body = any non-background category (0 = background)
    body_mask = (mask > 0).astype(np.uint8) * 255
    # clean up with morphology
    kernel = np.ones((5, 5), np.uint8)
    body_mask = cv2.morphologyEx(body_mask, cv2.MORPH_CLOSE, kernel)
    body_mask = cv2.morphologyEx(body_mask, cv2.MORPH_OPEN, kernel)
    return body_mask

def measure_front(img_array: np.ndarray) -> dict:
    lm, h, w = get_landmarks(img_array)
    if lm is None:
        return {"error": "No body detected in front photo"}
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

def measure_side(img_array: np.ndarray) -> dict:
    h, w = img_array.shape[:2]

    # Step 1: get landmarks for reference heights
    lm, h, w = get_landmarks(img_array)
    if lm is None:
        return {"error": "No body detected in side photo"}

    # Key vertical positions (in pixels)
    hip_y    = int(((lm[23].y + lm[24].y) / 2) * h)
    knee_y   = int(((lm[25].y + lm[26].y) / 2) * h)
    torso_h  = abs(lm[0].y - ((lm[23].y + lm[24].y) / 2)) * h

    if torso_h == 0:
        return {"error": "Could not measure torso from side"}

    # Step 2: get body silhouette mask
    mask = get_body_mask(img_array)
    if mask is None:
        # fallback to landmark-based if seg fails
        hip_x      = (lm[23].x + lm[24].x) / 2
        shoulder_x = (lm[11].x + lm[12].x) / 2
        glute_proj = abs(hip_x - shoulder_x) * w
        waist_d    = glute_proj * 0.7
        return {
            "glute_projection_ratio": round(glute_proj / torso_h, 4),
            "waist_depth_ratio":      round(waist_d / torso_h, 4),
            "torso_px_side":          round(torso_h, 1),
        }

    # Step 3: measure glute projection from contour
    # Glute zone = hip_y to 40% of the way to the knee
    glute_top    = hip_y
    glute_bottom = int(hip_y + (knee_y - hip_y) * 0.4)

    # Waist zone = 30% above hip to hip
    waist_top    = int(hip_y - torso_h * 0.3)
    waist_bottom = hip_y

    glute_top    = max(0, glute_top)
    glute_bottom = min(h, glute_bottom)
    waist_top    = max(0, waist_top)
    waist_bottom = min(h, waist_bottom)

    # For each zone, find max horizontal extent of the body mask
    def max_width_in_zone(mask, y_top, y_bottom):
        zone = mask[y_top:y_bottom, :]
        if zone.size == 0:
            return 0
        widths = []
        for row in zone:
            cols = np.where(row > 0)[0]
            if len(cols) >= 2:
                widths.append(cols[-1] - cols[0])
        return float(np.max(widths)) if widths else 0.0

    glute_width = max_width_in_zone(mask, glute_top, glute_bottom)
    waist_width = max_width_in_zone(mask, waist_top, waist_bottom)

    return {
        "glute_projection_ratio": round(glute_width / torso_h, 4),
        "waist_depth_ratio":      round(waist_width / torso_h, 4),
        "torso_px_side":          round(torso_h, 1),
    }

class ScoreRequest(BaseModel):
    current: dict
    previous: dict | None = None
    goals: list[str] = []
    first_scan_date: str | None = None
    retake: bool = False

def get_cycle_number(first_scan_date: str | None) -> int:
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

    sh_delta    = ((current["shoulder_ratio"] - previous["shoulder_ratio"]) / previous["shoulder_ratio"]) * 100
    hip_delta   = ((current["hip_ratio"] - previous["hip_ratio"]) / previous["hip_ratio"]) * 100
    waist_delta = ((current["waist_ratio"] - previous["waist_ratio"]) / previous["waist_ratio"]) * 100

    deltas["shoulders"] = round(sh_delta, 2)
    deltas["hips"]      = round(hip_delta, 2)
    deltas["waist"]     = round(waist_delta, 2)

    # Glute delta from side scan
    if (current.get("glute_projection_ratio") and
        previous.get("glute_projection_ratio") and
        previous["glute_projection_ratio"] > 0):
        glute_delta = ((current["glute_projection_ratio"] - previous["glute_projection_ratio"]) / previous["glute_projection_ratio"]) * 100
        deltas["glutes"] = round(glute_delta, 2)

    if "muscle" in goals or "recomp" in goals:
        score += sh_delta * 8
        score += hip_delta * 10
        score -= waist_delta * 4
        score += deltas.get("glutes", 0) * 12
    elif "fat" in goals:
        score -= waist_delta * 12
        score += sh_delta * 4
        score += deltas.get("glutes", 0) * 6
    elif "posture" in goals:
        score += sh_delta * 5
        score += hip_delta * 5
    else:
        score += sh_delta * 6
        score += hip_delta * 8
        score -= waist_delta * 5
        score += deltas.get("glutes", 0) * 10

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

@app.post("/scan/front")
async def scan_front(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        measurements = measure_front(img)
        if "error" in measurements:
            raise HTTPException(status_code=422, detail=measurements["error"])
        return {"success": True, "measurements": measurements}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan/side")
async def scan_side(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        measurements = measure_side(img)
        if "error" in measurements:
            raise HTTPException(status_code=422, detail=measurements["error"])
        return {"success": True, "measurements": measurements}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan")
async def scan(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        np_arr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        measurements = measure_front(img)
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