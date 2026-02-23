from fastapi import APIRouter, HTTPException
router=APIRouter(prefix="/logout",tags=["logout"])
@router.post("/")
def logout_user():
    response = HTTPException(status_code=200, detail="Logout successful")
    response.delete_cookie(key="user_id",
                           samesite="lax",
                           secure=False,
                           httponly=True
                           )
    return response