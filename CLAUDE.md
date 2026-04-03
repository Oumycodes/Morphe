# Morphe
Body scan app using computer vision to track muscle growth.
Users scan weekly — the app shows how their body is changing.

## Stack
- Frontend: React Native + Expo (TypeScript)
- Backend: Python FastAPI
- Database: PostgreSQL via Supabase
- CV (on-device): MediaPipe Pose + Selfie Segmentation
- Depth: MiDaS
- Image processing: OpenCV + Pillow
- Notifications: Expo Notifications

## Architecture
- CV runs entirely on-device. No video leaves the phone.
- Backend receives landmark JSON + measurements only.
- /app → React Native frontend
- /backend → FastAPI backend
- /scripts → standalone Python CV scripts

## Brand
- Primary: #1746A2 (Royal blue)
- Background: #FAFAF8
- Cards: white #FFFFFF
- Score: green #16A34A (80+), yellow #CA8A04 (60-79),
orange #EA580C (40-59), red #DC2626 (0-39)
- Font: system sans-serif, 800 weight headings

## Key screens
Splash → Goals (multi-select) → Body parts → Dashboard
→ Scan → Results (diff overlay + score)

## CV pipeline (on-device)
1. MediaPipe Pose: 33 landmarks
2. Selfie Segmentation: body silhouette
3. MiDaS: depth estimate
4. Measurement extraction: shoulder/waist/hip width
5. 30-frame smoothing
6. Normalisation: height-relative ratios

## Coding conventions
- TypeScript strict mode
- Python type hints everywhere
- Every function has a docstring
- Write tests alongside every new endpoint