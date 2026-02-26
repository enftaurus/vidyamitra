from langchain_google_genai import ChatGoogleGenerativeAI
from fastapi import APIRouter, Request, HTTPException
from services.db_client import supabase


