import mediapipe as mp
import cv2
import json
import sys
from pathlib import Path

mp_pose = mp.solutions.pose
mp_seg = mp.solutions.selfie_segmentation


def measure(image_path: str) -> dict:
    """Extract body measurements from a single photo."""
    img = cv2.imread(image_path)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]

    with mp_pose.Pose(static_image_mode=True) as pose:
        res = pose.process(rgb)

        if not res.pose_landmarks:
            return {"error": "No body detected"}

        lm = res.pose_landmarks.landmark

        # Key landmarks (normalized 0-1)
        l_shoulder = lm[mp_pose.PoseLandmark.LEFT_SHOULDER]
        r_shoulder = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER]
        l_hip = lm[mp_pose.PoseLandmark.LEFT_HIP]
        r_hip = lm[mp_pose.PoseLandmark.RIGHT_HIP]
        nose = lm[mp_pose.PoseLandmark.NOSE]

        # Raw pixel widths
        shoulder_w = abs(l_shoulder.x - r_shoulder.x) * w
        hip_w = abs(l_hip.x - r_hip.x) * w
        torso_h = abs(nose.y - ((l_hip.y + r_hip.y) / 2)) * h

        # Waist = midpoint between shoulders and hips
        waist_y = (l_shoulder.y + l_hip.y) / 2
        waist_w = shoulder_w * 0.75  # approximation v1

        # Normalize — divide by torso height
        if torso_h == 0:
            return {"error": "Could not measure torso"}

        return {
            "shoulder_ratio": round(shoulder_w / torso_h, 4),
            "hip_ratio": round(hip_w / torso_h, 4),
            "waist_ratio": round(waist_w / torso_h, 4),
            "torso_px": round(torso_h, 1),
        }


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "test.jpg"
    result = measure(path)
    print(json.dumps(result, indent=2))