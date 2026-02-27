from fastapi import APIRouter, Request, HTTPException
from  services.db_client import supabase
import os

router = APIRouter()
@router.get("/profile")
async def get_profile(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")
    try:
        response = supabase.rpc("get_full_candidate_profile", {"p_user_id": int(user_id)}).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "success": True,
            "data": response.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))