from fastapi import APIRouter
from fastapi.responses import JSONResponse
router=APIRouter(prefix="/logout",tags=["logout"])
@router.post("/")
def logout_user():
    response = JSONResponse(status_code=200, content={"message": "Logout successful"})
    response.delete_cookie(key="user_id",
                           samesite="lax",
                           secure=False,
                           httponly=True
                           )
    return response