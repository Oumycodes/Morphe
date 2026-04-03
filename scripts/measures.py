import mediapipe as mp
import cv2, json, sys, os, urllib.request

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker.task")

def download_model():
    if not os.path.exists(MODEL_PATH):
        print("Downloading pose model (~3MB)...")
        url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
        urllib.request.urlretrieve(url, MODEL_PATH)
        print("Done.")

def measure(image_path: str) -> dict:
    download_model()

    img = cv2.imread(image_path)
    if img is None:
        return {"error": f"Could not read image: {image_path}"}

    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(base_options=base_options)

    with vision.PoseLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(mp_image)

    if not result.pose_landmarks:
        return {"error": "No body detected — make sure full body is visible"}

    lm = result.pose_landmarks[0]

    shoulder_w = abs(lm[11].x - lm[12].x) * w
    hip_w      = abs(lm[23].x - lm[24].x) * w
    torso_h    = abs(lm[0].y - ((lm[23].y + lm[24].y) / 2)) * h

    if torso_h == 0:
        return {"error": "Could not measure torso height"}

    return {
        "shoulder_ratio": round(shoulder_w / torso_h, 4),
        "hip_ratio":      round(hip_w / torso_h, 4),
        "waist_ratio":    round((shoulder_w * 0.75) / torso_h, 4),
        "torso_px":       round(torso_h, 1),
        "image_size":     f"{w}x{h}",
    }

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "test.jpg"
    result = measure(path)
    print(json.dumps(result, indent=2))