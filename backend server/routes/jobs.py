from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from services.db_client import supabase
from services.leaderboard import register_quick_apply

router = APIRouter(prefix="/jobs", tags=["jobs"])


class QuickApplyPayload(BaseModel):
	job_id: int


@router.get("/")
def get_jobs():
	try:
		response = (
			supabase
			.table("jobs")
			.select("*")
			.execute()
		)
		return response.data
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-apply")
def quick_apply(payload: QuickApplyPayload, request: Request):
	user_id = request.cookies.get("user_id")
	if not user_id:
		raise HTTPException(status_code=401, detail="User not logged in")

	try:
		job_resp = (
			supabase
			.table("jobs")
			.select("id")
			.eq("id", payload.job_id)
			.limit(1)
			.execute()
		)

		if not job_resp.data:
			raise HTTPException(status_code=404, detail="Job not found")

		register_quick_apply(int(user_id), int(payload.job_id))
		return {"success": True, "job_id": int(payload.job_id)}
	except HTTPException:
		raise
	except Exception as e:
		raise HTTPException(status_code=500, detail=str(e))
