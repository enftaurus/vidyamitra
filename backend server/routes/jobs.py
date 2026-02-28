from fastapi import APIRouter, HTTPException

from services.db_client import supabase

router = APIRouter(prefix="/jobs", tags=["jobs"])


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
