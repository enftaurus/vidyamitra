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
    """Return all registered users with their profile details and skills."""
    try:
        users_resp = supabase.table("users").select("id, name, email").execute()
        users = users_resp.data or []

        enriched = []
        for u in users:
            entry = {"id": u["id"], "name": u.get("name", ""), "email": u.get("email", "")}
            try:
                profile_resp = supabase.rpc(
                    "get_full_candidate_profile", {"p_user_id": u["id"]}
                ).execute()
                if profile_resp.data:
                    row = profile_resp.data[0] if isinstance(profile_resp.data, list) else profile_resp.data
                    # Extract skills
                    skills_raw = row.get("skills") or []
                    if isinstance(skills_raw, str):
                        import json as _json
                        try:
                            skills_raw = _json.loads(skills_raw)
                        except Exception:
                            skills_raw = []
                    skill_names = []
                    for s in skills_raw:
                        if isinstance(s, dict):
                            skill_names.append(s.get("skill_name") or s.get("name") or str(s))
                        else:
                            skill_names.append(str(s))
                    entry["skills"] = skill_names

                    # Extract domain and bio from candidates sub-object or top level
                    candidates = row.get("candidates") or {}
                    if isinstance(candidates, str):
                        try:
                            candidates = _json.loads(candidates)
                        except Exception:
                            candidates = {}
                    entry["domain"] = candidates.get("domain") or row.get("domain") or ""
                    entry["bio"] = candidates.get("bio") or row.get("bio") or ""
                    entry["phone"] = candidates.get("phone") or row.get("phone") or ""
                else:
                    entry["skills"] = []
                    entry["domain"] = ""
                    entry["bio"] = ""
                    entry["phone"] = ""
            except Exception:
                entry["skills"] = []
                entry["domain"] = ""
                entry["bio"] = ""
                entry["phone"] = ""
            enriched.append(entry)

        return enriched
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
