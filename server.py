from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MOVED_BACKEND_DIR = os.path.join(BASE_DIR, "backend server")

if os.path.isdir(MOVED_BACKEND_DIR) and MOVED_BACKEND_DIR not in sys.path:
    sys.path.insert(0, MOVED_BACKEND_DIR)

env_path = os.path.join(MOVED_BACKEND_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

from services.db_client import supabase
#from services.redis import redis_client

from routes import login,register,logout,resume_upload,profile,domain_switch,technical_round,manager_round,hr_round,coding_round

app=FastAPI()
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
    ).split(",")
    if origin.strip()
]

required_dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
for origin in required_dev_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "vidyamitra-dev-session-secret"),
    same_site="lax",
    https_only=False,
)
app.include_router(login.router)
app.include_router(register.router)
app.include_router(logout.router)
app.include_router(resume_upload.router)
app.include_router(coding_round.router)
#@app.include_router(mock_interview.router)
app.include_router(technical_round.router)
app.include_router(manager_round.router)
app.include_router(hr_round.router)
app.include_router(domain_switch.router)
app.include_router(profile.router)
@app.get("/")
def read_root():
    return {"message": "Welcome to the VidyaMitra API!"}