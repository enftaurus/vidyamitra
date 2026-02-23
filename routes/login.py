from fastapi import APIRouter, HTTPException,Response
from models.login import login
from services.db_client import supabase
import bcrypt
router=APIRouter(prefix="/login",tags=["login"])
@router.post("/")
def login_user(user:login,response:Response):
    if not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    try:
        result=supabase.table("users").select("*").eq("email",user.email).execute()
        if result.data and len(result.data) > 0:
            if bcrypt.checkpw(user.password.encode('utf-8'), result.data[0]['password'].encode('utf-8')):
                response.set_cookie(key="user_id", 
                                    value=result.data[0]['id'],
                                    samesite="lax",
                                    secure=False,
                                    httponly=True
                                    )
                return {"message": "Login successful"}
        raise HTTPException(status_code=401, detail="Invalid email or password")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))