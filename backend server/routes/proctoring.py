import base64
import threading

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

try:
    import mediapipe as mp
except Exception:
    mp = None

router = APIRouter(prefix="/proctoring", tags=["proctoring"])


class FaceCheckPayload(BaseModel):
    image: str


face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

face_cascade_profile = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_profileface.xml"
)

face_detector = None
if mp is not None:
    try:
        face_detector = mp.solutions.face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.4,
        )
    except Exception:
        face_detector = None

face_detector_strict = None
if mp is not None:
    try:
        face_detector_strict = mp.solutions.face_detection.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.3,
        )
    except Exception:
        face_detector_strict = None

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


def _count_mediapipe_faces(
    frame: np.ndarray,
    detector,
    min_confidence: float,
    min_area_ratio: float,
) -> int:
    if detector is None:
        return 0

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    with face_detector_lock:
        results = detector.process(rgb_frame)

    detections = results.detections if results and results.detections else []
    valid_count = 0

    for detection in detections:
        score_list = detection.score or []
        confidence = float(score_list[0]) if score_list else 0.0
        if confidence < min_confidence:
            continue

        bbox = detection.location_data.relative_bounding_box
        area_ratio = max(0.0, float(bbox.width * bbox.height))
        if area_ratio < min_area_ratio:
            continue

        valid_count += 1

    return valid_count


def _count_opencv_faces_lenient(frame: np.ndarray) -> int:
    if face_cascade.empty():
        raise HTTPException(status_code=500, detail="Face detector is not initialized")

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=4,
        minSize=(30, 30),
    )

    height, width = frame.shape[:2]
    frame_area = float(max(1, width * height))
    return sum(
        1 for _, _, w, h in faces
        if float(w * h) / frame_area >= MIN_FACE_AREA_RATIO_LENIENT
    )


def _count_opencv_faces_strict(frame: np.ndarray) -> int:
    if face_cascade.empty():
        return 0

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    height, width = frame.shape[:2]
    frame_area = float(max(1, width * height))
    detected_boxes = []

    frontal = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.05,
        minNeighbors=3,
        minSize=(25, 25),
    )
    if len(frontal):
        detected_boxes.extend(frontal.tolist())

    if not face_cascade_profile.empty():
        profile = face_cascade_profile.detectMultiScale(
            gray,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(25, 25),
        )
        if len(profile):
            detected_boxes.extend(profile.tolist())

        flipped = cv2.flip(gray, 1)
        profile_flipped = face_cascade_profile.detectMultiScale(
            flipped,
            scaleFactor=1.05,
            minNeighbors=3,
            minSize=(25, 25),
        )
        if len(profile_flipped):
            for x, y, w, h in profile_flipped:
                detected_boxes.append([width - x - w, y, w, h])

    valid_boxes = [
        box for box in detected_boxes
        if float(box[2] * box[3]) / frame_area >= MIN_FACE_AREA_RATIO_STRICT
    ]

    return _deduplicate_boxes(valid_boxes)


def _deduplicate_boxes(boxes: list, iou_threshold: float = 0.3) -> int:
    if not boxes:
        return 0

    boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    kept = []

    for box in boxes:
        x1, y1, w1, h1 = box
        merged = False
        for kx, ky, kw, kh in kept:
            ix = max(x1, kx)
            iy = max(y1, ky)
            ix2 = min(x1 + w1, kx + kw)
            iy2 = min(y1 + h1, ky + kh)
            inter = max(0, ix2 - ix) * max(0, iy2 - iy)
            union = w1 * h1 + kw * kh - inter
            if union > 0 and inter / union > iou_threshold:
                merged = True
                break
        if not merged:
            kept.append(box)

    return len(kept)


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

    lenient_count = 0
    engine = "opencv"

    if face_detector is not None:
        lenient_count = _count_mediapipe_faces(
            frame, face_detector,
            MIN_FACE_CONFIDENCE_LENIENT,
            MIN_FACE_AREA_RATIO_LENIENT,
        )
        engine = "mediapipe"

        if lenient_count == 0:
            try:
                fallback = _count_opencv_faces_lenient(frame)
            except Exception:
                fallback = 0
            if fallback > 0:
                lenient_count = fallback
                engine = "opencv_fallback"
    else:
        lenient_count = _count_opencv_faces_lenient(frame)

    strict_count = 0

    if face_detector_strict is not None:
        strict_count = _count_mediapipe_faces(
            frame, face_detector_strict,
            MIN_FACE_CONFIDENCE_STRICT,
            MIN_FACE_AREA_RATIO_STRICT,
        )

    try:
        opencv_strict_count = _count_opencv_faces_strict(frame)
    except Exception:
        opencv_strict_count = 0

    strict_count = max(strict_count, opencv_strict_count)

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
