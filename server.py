from fastapi import FastAPI
from dotenv import load_dotenv
load_dotenv()
from services.db_client import supabase

from routes import login,register,logout,resume_upload

app=FastAPI()
app.include_router(login.router)
app.include_router(register.router)
app.include_router(logout.router)
app.include_router(resume_upload.router)
@app.get("/")
def read_root():
    return {"message": "Welcome to the VidyaMitra API!"}