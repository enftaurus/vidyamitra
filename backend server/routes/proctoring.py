import base64
import threading

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

try:
    from insightface.app import FaceAnalysis
except ImportError:
    FaceAnalysis = None

router = APIRouter(prefix="/proctoring", tags=["proctoring"])


class FaceCheckPayload(BaseModel):
    image: str


face_app = None
if FaceAnalysis is not None:
    try:
        # Initialize lightweight CPU model for quick inference
        face_app = FaceAnalysis(name='buffalo_sc', providers=['CPUExecutionProvider'], allowed_modules=['detection'])
        face_app.prepare(ctx_id=0, det_size=(320, 320))
    except Exception as e:
        print(f"Failed to load InsightFace model: {e}")
        face_app = None

face_detector_lock = threading.Lock()

MIN_FACE_CONFIDENCE_LENIENT = 0.4
MIN_FACE_AREA_RATIO_LENIENT = 0.002

MIN_FACE_CONFIDENCE_STRICT = 0.25
MIN_FACE_AREA_RATIO_STRICT = 0.001
LOW_LIGHT_THRESHOLD = 50.0
BLUR_THRESHOLD = 45.0


def _decode_data_url_to_image(data_url: str) -> np.ndarray:
    if not data_url or not isinstance(data_url, str):
        raise HTTPException(status_code=400, detail="Invalid image payload")

    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url

    try:
        raw_bytes = base64.b64decode(encoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    np_buffer = np.frombuffer(raw_bytes, dtype=np.uint8)
    frame = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Unable to decode image")
    return frame


def _count_insightface_faces(frame: np.ndarray, min_confidence: float, min_area_ratio: float) -> int:
    if face_app is None:
        return 0
        
    height, width = frame.shape[:2]
    frame_area = float(max(1, width * height))
    
    with face_detector_lock:
        faces = face_app.get(frame)
        
    valid_count = 0
    for face in faces:
        if face.det_score < min_confidence:
            continue
            
        bbox = face.bbox
        face_width = max(0, bbox[2] - bbox[0])
        face_height = max(0, bbox[3] - bbox[1])
        area_ratio = (face_width * face_height) / frame_area
        
        if area_ratio < min_area_ratio:
            continue
            
        valid_count += 1
        
    return valid_count


def _analyze_frame_quality(frame: np.ndarray) -> dict:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    low_light = brightness < LOW_LIGHT_THRESHOLD
    blurry = blur_score < BLUR_THRESHOLD

    return {
        "brightness": round(brightness, 2),
        "blur_score": round(blur_score, 2),
        "low_light": low_light,
        "blurry": blurry,
    }


@router.post("/face-check")
def face_check(payload: FaceCheckPayload, request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    frame = _decode_data_url_to_image(payload.image)
    quality = _analyze_frame_quality(frame)

    if face_app is None:
        raise HTTPException(status_code=500, detail="Face detector is not initialized on the server.")

    lenient_count = _count_insightface_faces(
        frame, MIN_FACE_CONFIDENCE_LENIENT, MIN_FACE_AREA_RATIO_LENIENT
    )
    strict_count = _count_insightface_faces(
        frame, MIN_FACE_CONFIDENCE_STRICT, MIN_FACE_AREA_RATIO_STRICT
    )
    
    engine = "insightface"

    if strict_count >= 2:
        face_count = strict_count
        status = "multiple_faces"
    elif lenient_count == 0:
        face_count = 0
        status = "no_face"
    else:
        face_count = lenient_count
        status = "single_face"

    return {
        "face_count": face_count,
        "status": status,
        "multiple_faces": status == "multiple_faces",
        "engine": engine,
        "quality": quality,
        "debug": {
            "lenient_count": int(lenient_count),
            "strict_count": int(strict_count),
        },
    }
