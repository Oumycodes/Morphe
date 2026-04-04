from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
import cv2
import numpy as np
import json
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
    hip_w = abs(lm[23].x - lm[24].x) * w
    torso_h = abs(lm[0].y - ((lm[23].y + lm[24].y) / 2)) * h
    if torso_h == 0:
        return {"error": "Could not measure torso"}
    return {
        "shoulder_ratio": round(shoulder_w / torso_h, 4),
        "hip_ratio": round(hip_w / torso_h, 4),
        "waist_ratio": round((shoulder_w * 0.75) / torso_h, 4),
        "torso_px": round(torso_h, 1),
    }

def calculate_score(measurements: dict, prev_measurements: dict | None) -> int:
    if not prev_measurements:
        return 50
    score = 50
    shoulder_delta = measurements["shoulder_ratio"] - prev_measurements["shoulder_ratio"]
    hip_delta = measurements["hip_ratio"] - prev_measurements["hip_ratio"]
    waist_delta = measurements["waist_ratio"] - prev_measurements["waist_ratio"]
    score += shoulder_delta * 200
    score += hip_delta * 200
    score -= waist_delta * 100
    return max(0, min(100, round(score)))

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
        return {
            "success": True,
            "measurements": measurements,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))