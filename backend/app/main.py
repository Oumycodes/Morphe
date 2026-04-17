from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
import requests as http_requests
import base64
import cv2
import numpy as np
import os
import json
import traceback
import urllib.request
import onnxruntime as ort
from scipy import ndimage
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import mediapipe as mp

from score import compute_progress_score
from recommendations import build_muscle_reports, detect_asymmetry, narrate_reports

app = FastAPI(title="Morphe API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

OPENAI_KEY = ''.join(c for c in os.environ.get("OPENAI_API_KEY", "") if ord(c) < 128).strip()
print(f"OpenAI key loaded — length: {len(OPENAI_KEY)}")

U2NET_PATH = os.path.join(os.path.dirname(__file__), "u2net.onnx")
POSE_PATH  = os.path.join(os.path.dirname(__file__), "pose_landmarker.task")

# Load U2Net once at startup
u2net_session = None
def get_u2net():
    global u2net_session
    if u2net_session is None:
        print("Loading U2Net model...")
        u2net_session = ort.InferenceSession(U2NET_PATH, providers=["CPUExecutionProvider"])
        print("U2Net loaded.")
    return u2net_session

def download_pose_model():
    if not os.path.exists(POSE_PATH):
        print("Downloading pose model...")
        url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        urllib.request.urlretrieve(url, POSE_PATH)

# ── Segmentation ─────────────────────────────────────────────────────────────

def segment_body(img_bgr: np.ndarray) -> np.ndarray:
    """Run U2Net segmentation. Returns binary mask (0/255) same size as input."""
    h, w = img_bgr.shape[:2]
    # Preprocess
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    inp = cv2.resize(img_rgb, (320, 320)).astype(np.float32) / 255.0
    inp = (inp - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    inp = inp.transpose(2, 0, 1)[np.newaxis].astype(np.float32)
    # Run
    sess = get_u2net()
    input_name = sess.get_inputs()[0].name
    output = sess.run(None, {input_name: inp})[0][0, 0]
    # Postprocess
    mask = (output > 0.5).astype(np.uint8) * 255
    mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)
    # Clean up with morphology
    kernel = np.ones((7, 7), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return mask

# ── Pose landmarks ────────────────────────────────────────────────────────────

def get_landmarks(img_bgr: np.ndarray):
    download_pose_model()
    h, w = img_bgr.shape[:2]
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    base_options = python.BaseOptions(model_asset_path=POSE_PATH)
    options = vision.PoseLandmarkerOptions(base_options=base_options)
    with vision.PoseLandmarker.create_from_options(options) as lm:
        result = lm.detect(mp_image)
    if not result.pose_landmarks:
        return None, h, w
    return result.pose_landmarks[0], h, w

# ── Geometry helpers ──────────────────────────────────────────────────────────

def width_at_y(mask: np.ndarray, y: int, margin: int = 5) -> float:
    """Measure body width (in pixels) at a given y coordinate."""
    y = max(0, min(mask.shape[0] - 1, y))
    y_start = max(0, y - margin)
    y_end   = min(mask.shape[0], y + margin)
    zone = mask[y_start:y_end, :]
    widths = []
    for row in zone:
        cols = np.where(row > 0)[0]
        if len(cols) >= 2:
            widths.append(int(cols[-1]) - int(cols[0]))
    return float(np.median(widths)) if widths else 0.0

def max_projection_in_zone(mask: np.ndarray, y_top: int, y_bottom: int) -> float:
    """For side view: max horizontal extent of body in a vertical zone."""
    y_top    = max(0, y_top)
    y_bottom = min(mask.shape[0], y_bottom)
    zone = mask[y_top:y_bottom, :]
    widths = []
    for row in zone:
        cols = np.where(row > 0)[0]
        if len(cols) >= 2:
            widths.append(int(cols[-1]) - int(cols[0]))
    return float(np.max(widths)) if widths else 0.0

# ── Front measurement ─────────────────────────────────────────────────────────

def measure_front(img_bgr: np.ndarray) -> dict:
    h, w = img_bgr.shape[:2]

    # 1. Segmentation
    mask = segment_body(img_bgr)

    # 2. Pose landmarks for anchors
    lm, h, w = get_landmarks(img_bgr)
    if lm is None:
        return {"error": "No body detected in front photo"}

    # Key y positions
    head_y      = int(lm[0].y * h)
    shoulder_y  = int(((lm[11].y + lm[12].y) / 2) * h)
    hip_y       = int(((lm[23].y + lm[24].y) / 2) * h)
    waist_y     = int((shoulder_y + hip_y) / 2)
    torso_h     = abs(head_y - hip_y)

    if torso_h < 10:
        return {"error": "Could not measure torso height"}

    # 3. Measure widths from contour
    shoulder_w  = width_at_y(mask, shoulder_y)
    waist_w     = width_at_y(mask, waist_y)
    hip_w       = width_at_y(mask, hip_y)

    if shoulder_w == 0 or hip_w == 0:
        return {"error": "Could not measure body widths"}

    print(f"Front — torso_h: {torso_h}, shoulder_w: {shoulder_w:.1f}, waist_w: {waist_w:.1f}, hip_w: {hip_w:.1f}")

    return {
        "shoulder_ratio": round(shoulder_w / torso_h, 4),
        "hip_ratio":      round(hip_w / torso_h, 4),
        "waist_ratio":    round(waist_w / torso_h, 4),
        "torso_px":       round(float(torso_h), 1),
    }

# ── Side measurement ──────────────────────────────────────────────────────────

def measure_side(img_bgr: np.ndarray) -> dict:
    h, w = img_bgr.shape[:2]

    # 1. Segmentation
    mask = segment_body(img_bgr)

    # 2. Pose landmarks for zone anchors
    lm, h, w = get_landmarks(img_bgr)
    if lm is None:
        return {"error": "No body detected in side photo"}

    head_y     = int(lm[0].y * h)
    hip_y      = int(((lm[23].y + lm[24].y) / 2) * h)
    knee_y     = int(((lm[25].y + lm[26].y) / 2) * h)
    shoulder_y = int(((lm[11].y + lm[12].y) / 2) * h)
    torso_h    = abs(head_y - hip_y)
    waist_y    = int((shoulder_y + hip_y) / 2)

    if torso_h < 10:
        return {"error": "Could not measure torso from side"}

    # 3. Glute zone: hip to 40% of way to knee
    glute_top    = hip_y
    glute_bottom = int(hip_y + (knee_y - hip_y) * 0.4)

    # 4. Waist zone: 30% of torso above hip
    waist_top    = int(hip_y - torso_h * 0.3)
    waist_bottom = hip_y

    glute_proj = max_projection_in_zone(mask, glute_top, glute_bottom)
    waist_proj = max_projection_in_zone(mask, waist_top, waist_bottom)

    if glute_proj == 0:
        glute_proj = torso_h * 0.30  # fallback

    print(f"Side — torso_h: {torso_h}, glute_proj: {glute_proj:.1f}, waist_proj: {waist_proj:.1f}")

    return {
        "glute_projection_ratio": round(glute_proj / torso_h, 4),
        "waist_depth_ratio":      round(waist_proj / torso_h, 4),
        "torso_px_side":          round(float(torso_h), 1),
    }

# ── Combined measurement ──────────────────────────────────────────────────────

def measure_both(front_img: np.ndarray, side_img: np.ndarray) -> dict:
    front = measure_front(front_img)
    if "error" in front:
        return front
    side = measure_side(side_img)
    if "error" in side:
        # Side failed — still return front measurements with fallback glute
        side = {
            "glute_projection_ratio": 0.30,
            "waist_depth_ratio": 0.25,
            "torso_px_side": front["torso_px"],
        }
    return {**front, **side, "confidence": 0.9}

# ── GPT text insight only ─────────────────────────────────────────────────────

def get_gpt_insight(measurements: dict, deltas: dict, goals: list) -> str:
    if not OPENAI_KEY or not deltas:
        return ""
    try:
        delta_text = ", ".join([f"{k}: {'+' if v > 0 else ''}{v:.1f}%" for k, v in deltas.items()])
        goal_text  = ", ".join(goals) if goals else "general fitness"
        prompt = f"Fitness tracking summary. Goals: {goal_text}. Changes this week: {delta_text}. Write one encouraging sentence about their progress. Be specific and brief."
        payload = {
            "model": "gpt-4o-mini",
            "max_tokens": 80,
            "messages": [{"role": "user", "content": prompt}]
        }
        headers = {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"}
        response = http_requests.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers, timeout=15)
        if response.status_code == 200:
            return response.json()["choices"][0]["message"]["content"].strip()
    except:
        pass
    return ""

# ── Score engine ──────────────────────────────────────────────────────────────

class ScoreRequest(BaseModel):
    current: dict
    previous: dict | None = None
    baseline: dict | None = None
    goal: dict = {}
    first_scan_date: str | None = None
    retake: bool = False
    previous_score: int | None = None

def get_cycle_number(first_scan_date):
    if not first_scan_date:
        return 1
    try:
        first = datetime.fromisoformat(first_scan_date.replace('Z', '+00:00'))
        now   = datetime.now(timezone.utc)
        return max(1, ((now - first).days // 5) + 1)
    except:
        return 1

def can_scan_today(last_scan_date, retake):
    if not last_scan_date:
        return {"allowed": True, "reason": "first_scan"}
    if retake:
        return {"allowed": True, "reason": "retake"}
    try:
        last = datetime.fromisoformat(last_scan_date.replace('Z', '+00:00'))
        now  = datetime.now(timezone.utc)
        days_since = (now - last).days
        if days_since < 0:
            days_remaining = 5 - days_since
            return {"allowed": False, "reason": "too_soon", "days_remaining": days_remaining,
                    "next_scan_in": f"{days_remaining} day{'s' if days_remaining > 1 else ''}"}
        return {"allowed": True, "reason": "cycle_complete"}
    except:
        return {"allowed": True, "reason": "error"}

# ── API routes ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Morphe API — U2Net + OpenCV pipeline"}

@app.post("/scan/both")
async def scan_both(front: UploadFile = File(...), side: UploadFile = File(...)):
    try:
        print("Received /scan/both request")
        front_contents = await front.read()
        side_contents  = await side.read()
        front_img = cv2.imdecode(np.frombuffer(front_contents, np.uint8), cv2.IMREAD_COLOR)
        side_img  = cv2.imdecode(np.frombuffer(side_contents,  np.uint8), cv2.IMREAD_COLOR)
        if front_img is None or side_img is None:
            raise HTTPException(status_code=400, detail="Invalid image")
        print(f"front: {front_img.shape}, side: {side_img.shape}")
        measurements = measure_both(front_img, side_img)
        if "error" in measurements:
            raise HTTPException(status_code=422, detail=measurements["error"])
        return {"success": True, "measurements": measurements}
    except HTTPException:
        raise
    except Exception as e:
        print(f"scan_both error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scan/front")
async def scan_front(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
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
    return {"success": True, "measurements": {}}

@app.post("/scan")
async def scan(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
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
        result = compute_progress_score(req.current, req.baseline, req.previous, req.goal, req.previous_score)
        reports = build_muscle_reports(req.current, req.baseline, req.previous, req.goal)
        asymmetry = detect_asymmetry(req.current)
        narration = narrate_reports(reports, req.goal, result.get("score"))
        result["cycle_number"] = get_cycle_number(req.first_scan_date)
        result["muscle_reports"] = reports
        result["asymmetry"] = asymmetry
        result["narration"] = narration
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class ScanCheckRequest(BaseModel):
    last_scan_date: str | None = None
    retake: bool = False

@app.post("/can-scan")
async def check_can_scan(req: ScanCheckRequest):
    return can_scan_today(req.last_scan_date, req.retake)