from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from services.db_client import supabase

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_saved_coding_profiles(user_id: int) -> dict:
    try:
        response = (
            supabase
            .table("coding_profiles")
            .select("leetcode_username,codeforces_username,codechef_username,github_username")
            .eq("user_id", user_id)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return {
                "leetcode": None,
                "codeforces": None,
                "codechef": None,
                "github": None,
            }

        row = rows[0]
        return {
            "leetcode": row.get("leetcode_username"),
            "codeforces": row.get("codeforces_username"),
            "codechef": row.get("codechef_username"),
            "github": row.get("github_username"),
        }
    except Exception:
        return {
            "leetcode": None,
            "codeforces": None,
            "codechef": None,
            "github": None,
        }


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    description: str
    no_of_people: int = Field(..., ge=1)
    job_role: Optional[str] = None
    apply_url: Optional[str] = None
    is_external: Optional[bool] = False


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

        saved_profiles = _get_saved_coding_profiles(user_id)
        data = response.data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            data[0]["coding_profiles"] = saved_profiles
        elif isinstance(data, dict):
            data["coding_profiles"] = saved_profiles

        return {"success": True, "data": data}
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


@router.get("/jobs/{job_id}/leaderboard")
def job_leaderboard(job_id: int):
    """Return leaderboard entries for a Vidyamitra-posted job (non-external only)."""
    try:
        job_resp = (
            supabase
            .table("jobs")
            .select("id,is_external,title,company")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        if not job_resp.data:
            raise HTTPException(status_code=404, detail="Job not found")

        job = job_resp.data[0]
        is_external = job.get("is_external") in (True, "true", 1)
        if is_external:
            raise HTTPException(status_code=400, detail="Leaderboard is available only for Vidyamitra-posted jobs")

        board_resp = (
            supabase
            .table("leaderboard")
            .select("user_id,score")
            .eq("job_id", job_id)
            .order("score", desc=True)
            .execute()
        )
        rows = board_resp.data or []

        result = []
        for index, row in enumerate(rows, start=1):
            user_id = int(row.get("user_id")) if row.get("user_id") is not None else None
            user_name = "Unknown"
            user_email = ""

            if user_id is not None:
                try:
                    user_resp = (
                        supabase
                        .table("users")
                        .select("id,name,email")
                        .eq("id", user_id)
                        .limit(1)
                        .execute()
                    )
                    if user_resp.data:
                        user_name = user_resp.data[0].get("name") or "Unknown"
                        user_email = user_resp.data[0].get("email") or ""
                except Exception:
                    pass

            result.append(
                {
                    "rank": index,
                    "user_id": user_id,
                    "name": user_name,
                    "email": user_email,
                    "total_score": int(row.get("score") or 0),
                }
            )

        return {
            "success": True,
            "job": {
                "id": job.get("id"),
                "title": job.get("title"),
                "company": job.get("company"),
            },
            "entries": result,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
