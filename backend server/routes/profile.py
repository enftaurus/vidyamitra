from fastapi import APIRouter, Request, HTTPException
from  services.db_client import supabase

router = APIRouter(tags=["profile"])


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


@router.get("/profile")
async def get_profile(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")
    try:
        response = supabase.rpc("get_full_candidate_profile", {"p_user_id": int(user_id)}).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        saved_profiles = _get_saved_coding_profiles(int(user_id))
        data = response.data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            data[0]["coding_profiles"] = saved_profiles
        elif isinstance(data, dict):
            data["coding_profiles"] = saved_profiles

        return {
            "success": True,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))