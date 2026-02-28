from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.db_client import supabase

router = APIRouter(prefix="/admin", tags=["admin"])


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    apply_url: Optional[str] = None


@router.get("/users")
def list_users():
    """Return all registered users (id, name, email)."""
    try:
        response = supabase.table("users").select("id, name, email").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile/{user_id}")
def get_user_profile(user_id: int):
    """Return the full candidate profile for a given user id."""
    try:
        response = supabase.rpc(
            "get_full_candidate_profile", {"p_user_id": user_id}
        ).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        return {"success": True, "data": response.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/jobs")
def create_job(job: JobCreate):
    """Insert a new job posting into the jobs table."""
    try:
        payload = job.dict(exclude_none=True)
        response = supabase.table("jobs").insert(payload).execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int):
    """Delete a job posting by id."""
    try:
        response = supabase.table("jobs").delete().eq("id", job_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
