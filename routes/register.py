from fastapi import APIRouter, HTTPException,Response
from models.register import register
from services.db_client import supabase
import bcrypt
router=APIRouter(prefix="/register",tags=["register"])
@router.post("/")
def register_user(user:register,response:Response):
    if not user.name or not user.email or not user.password:
        raise HTTPException(status_code=400, detail="Name, email and password are required")
    try:
        hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        result=supabase.table("users").insert({"name":user.name,"email":user.email,"password":hashed_password}).execute()
        return {"message": "Registration successful"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))