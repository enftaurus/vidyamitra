from fastapi import APIRouter, Request
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage



router = APIRouter(prefix="/mock_interview", tags=["mock_interview"])
