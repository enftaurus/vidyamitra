from fastapi import APIRouter, Request, HTTPException
from services.round_flow import get_flow_state, reset_flow_state

router = APIRouter(prefix="/interview_flow", tags=["interview_flow"])


@router.get("/status")
def get_status(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    return {"status": get_flow_state(str(user_id))}


@router.post("/reset")
def reset_status(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    return {"status": reset_flow_state(str(user_id))}
