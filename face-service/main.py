from __future__ import annotations

import logging
import os
import time
from io import BytesIO
from dataclasses import dataclass
from threading import Lock
from typing import Any

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from deepface import DeepFace

APP_TITLE = "IntervueAI Face Service"
DEFAULT_MATCH_THRESHOLD = 0.56
DEFAULT_MAX_IMAGE_SIDE = 640

logger = logging.getLogger("intervueai.face-service")
logging.basicConfig(level=logging.INFO)


@dataclass
class SessionFaceState:
    reference_image_rgb: np.ndarray
    last_box: tuple[int, int, int, int] | None = None
    last_seen_at: float | None = None


app = FastAPI(title=APP_TITLE, version="1.0.0")

allowed_origins_raw = os.getenv(
    "FACE_SERVICE_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
allowed_origins_raw = allowed_origins_raw.strip()
if allowed_origins_raw == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [item.strip() for item in allowed_origins_raw.split(",") if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

_store_lock = Lock()
_face_store: dict[str, SessionFaceState] = {}

_mp_face_detection = mp.solutions.face_detection.FaceDetection(
    model_selection=0,
    min_detection_confidence=0.5,
)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "success": True,
        "service": APP_TITLE,
        "active_sessions": len(_face_store),
    }


async def _read_image_rgb(upload: UploadFile) -> np.ndarray:
    if not upload.content_type or not upload.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="image must be a valid image upload")

    data = await upload.read()
    if not data:
        raise HTTPException(status_code=400, detail="image is required")

    try:
        image = Image.open(BytesIO(data))
        image = image.convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="unable to decode image") from exc

    return np.array(image)


def _to_bgr(image_rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)


def _resize_for_inference(image_rgb: np.ndarray, max_side: int = DEFAULT_MAX_IMAGE_SIDE) -> np.ndarray:
    height, width = image_rgb.shape[:2]
    longest_side = max(height, width)
    if longest_side <= max_side:
        return image_rgb

    scale = max_side / float(longest_side)
    new_width = max(1, int(width * scale))
    new_height = max(1, int(height * scale))
    return cv2.resize(image_rgb, (new_width, new_height), interpolation=cv2.INTER_AREA)


def _detect_faces(image_rgb: np.ndarray) -> list[tuple[int, int, int, int]]:
    resized = _resize_for_inference(image_rgb)
    result = _mp_face_detection.process(resized)

    if not result.detections:
        return []

    height, width = resized.shape[:2]
    boxes: list[tuple[int, int, int, int]] = []

    for detection in result.detections:
        bbox = detection.location_data.relative_bounding_box
        x1 = max(0, int(bbox.xmin * width))
        y1 = max(0, int(bbox.ymin * height))
        w = max(1, int(bbox.width * width))
        h = max(1, int(bbox.height * height))
        x2 = min(width, x1 + w)
        y2 = min(height, y1 + h)
        boxes.append((y1, x2, y2, x1))

    return boxes


def _current_threshold() -> float:
    raw = os.getenv("FACE_MATCH_THRESHOLD", str(DEFAULT_MATCH_THRESHOLD)).strip()
    try:
        value = float(raw)
    except ValueError:
        value = DEFAULT_MATCH_THRESHOLD
    return max(0.35, min(0.8, value))


def _movement_score(previous_box: tuple[int, int, int, int] | None, current_box: tuple[int, int, int, int]) -> float:
    if previous_box is None:
        return 0.0

    top_a, right_a, bottom_a, left_a = previous_box
    top_b, right_b, bottom_b, left_b = current_box

    center_a = ((left_a + right_a) / 2.0, (top_a + bottom_a) / 2.0)
    center_b = ((left_b + right_b) / 2.0, (top_b + bottom_b) / 2.0)

    dx = center_a[0] - center_b[0]
    dy = center_a[1] - center_b[1]
    return float((dx * dx + dy * dy) ** 0.5)


def _verify_identity(reference_image_rgb: np.ndarray, current_image_rgb: np.ndarray) -> tuple[bool, float | None]:
    try:
        verify_result = DeepFace.verify(
            img1_path=_to_bgr(reference_image_rgb),
            img2_path=_to_bgr(current_image_rgb),
            model_name=os.getenv("DEEPFACE_MODEL_NAME", "Facenet512"),
            detector_backend="opencv",
            enforce_detection=False,
            distance_metric=os.getenv("DEEPFACE_DISTANCE_METRIC", "cosine"),
            silent=True,
        )
    except Exception as exc:
        logger.exception("DeepFace verify failed")
        raise HTTPException(status_code=503, detail="Face verification temporarily unavailable") from exc

    distance = verify_result.get("distance")
    try:
        distance_value = float(distance)
    except (TypeError, ValueError):
        distance_value = None

    threshold = _current_threshold()
    if distance_value is None:
        verified = bool(verify_result.get("verified", False))
        return verified, None

    return distance_value <= threshold, distance_value


@app.post("/register-face")
async def register_face(
    session_id: str = Form(...),
    image: UploadFile = File(...),
) -> dict[str, Any]:
    normalized_session_id = session_id.strip()
    if not normalized_session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    image_rgb = await _read_image_rgb(image)
    boxes = _detect_faces(image_rgb)

    if len(boxes) != 1:
        return {
            "status": "error",
            "message": "Require exactly one face",
            "face_count": len(boxes),
        }

    face_state = SessionFaceState(
        reference_image_rgb=image_rgb,
        last_box=boxes[0],
        last_seen_at=time.time(),
    )

    with _store_lock:
        _face_store[normalized_session_id] = face_state

    return {
        "status": "success",
        "message": "Face registered",
        "face_count": 1,
    }


@app.post("/verify-face")
async def verify_face(
    session_id: str = Form(...),
    image: UploadFile = File(...),
) -> dict[str, Any]:
    normalized_session_id = session_id.strip()
    if not normalized_session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    with _store_lock:
        stored = _face_store.get(normalized_session_id)

    if stored is None:
        raise HTTPException(status_code=404, detail="No registered face for this session")

    image_rgb = await _read_image_rgb(image)
    boxes = _detect_faces(image_rgb)

    face_count = len(boxes)
    if face_count == 0:
        return {
            "face_count": 0,
            "match": False,
            "distance": None,
        }

    if face_count > 1:
        return {
            "face_count": face_count,
            "match": False,
            "distance": None,
        }

    match, distance = _verify_identity(stored.reference_image_rgb, image_rgb)

    movement = _movement_score(stored.last_box, boxes[0])

    with _store_lock:
        _face_store[normalized_session_id] = SessionFaceState(
            reference_image_rgb=stored.reference_image_rgb,
            last_box=boxes[0],
            last_seen_at=time.time(),
        )

    return {
        "face_count": face_count,
        "match": match,
        "distance": round(distance, 4) if distance is not None else None,
        "threshold": _current_threshold(),
        "liveness": {
            "movement_score": round(movement, 2),
            "movement_detected": bool(movement >= 2.5),
        },
    }


@app.delete("/sessions/{session_id}")
def clear_session(session_id: str) -> dict[str, Any]:
    normalized_session_id = session_id.strip()
    removed = False

    with _store_lock:
        if normalized_session_id in _face_store:
            _face_store.pop(normalized_session_id, None)
            removed = True

    return {
        "success": True,
        "removed": removed,
    }
