import base64

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/proctoring", tags=["proctoring"])


class FaceCheckPayload(BaseModel):
    image: str


face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def _decode_data_url_to_image(data_url: str):
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


@router.post("/face-check")
def face_check(payload: FaceCheckPayload, request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    if face_cascade.empty():
        raise HTTPException(status_code=500, detail="Face detector is not initialized")

    frame = _decode_data_url_to_image(payload.image)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.3,
        minNeighbors=5,
        minSize=(30, 30),
    )

    face_count = int(len(faces))
    if face_count == 0:
        status = "no_face"
    elif face_count > 1:
        status = "multiple_faces"
    else:
        status = "single_face"

    return {
        "face_count": face_count,
        "status": status,
        "multiple_faces": face_count > 1,
    }
