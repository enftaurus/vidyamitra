from fastapi import APIRouter, HTTPException
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stt", tags=["Speech-to-Text"])

DEEPGRAM_API_KEY = os.getenv("DEEP_API", "")


@router.get("/token")
def get_deepgram_token():
    """
    Return the Deepgram API key so the frontend can connect directly
    to Deepgram's WebSocket streaming endpoint.
    In production, you'd create a short-lived scoped key via Deepgram's API.
    For development, we return the main key.
    """
    if not DEEPGRAM_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Deepgram API key is not configured (DEEP_API env var)",
        )
    return {"token": DEEPGRAM_API_KEY}
