# IntervueAI Face Service

Independent FastAPI microservice for face registration and continuous identity verification.

## Run locally

```bash
cd face-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `POST /register-face`
  - multipart fields:
    - `session_id` (string)
    - `image` (jpeg/png frame)
- `POST /verify-face`
  - multipart fields:
    - `session_id` (string)
    - `image` (jpeg/png frame)
- `DELETE /sessions/{session_id}`

## Environment variables

- `FACE_SERVICE_CORS_ORIGINS` (default: `http://localhost:5173`)
- `FACE_MATCH_THRESHOLD` (default: `0.56`, clamped to `0.35`..`0.8`)
- `DEEPFACE_MODEL_NAME` (default: `Facenet512`)
- `DEEPFACE_DISTANCE_METRIC` (default: `cosine`)

Runtime compatibility note:

- The service sets `TF_USE_LEGACY_KERAS=1` before importing DeepFace to avoid model initialization issues on TensorFlow 2.19+.

## Security and storage

- Raw images are never persisted to disk.
- Reference face images are stored only in memory per `session_id`.
- Session cleanup endpoint is available and called by the frontend when monitoring stops.
