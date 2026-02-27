from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()
from services.db_client import supabase
from services.redis import redis_client

from routes import login,register,logout,resume_upload,coding_round,profile,domain_switch,technical_round

app=FastAPI()
app.add_middleware( CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(login.router)
app.include_router(register.router)
app.include_router(logout.router)
app.include_router(resume_upload.router)
app.include_router(coding_round.router)
#@app.include_router(mock_interview.router)
app.include_router(technical_round.router)
app.include_router(profile.router)
@app.get("/")
def read_root():
    return {"message": "Welcome to the VidyaMitra API!"}