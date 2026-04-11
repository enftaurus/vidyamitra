from fastapi import APIRouter, Request, HTTPException
from services.db_client import supabase
from models.domain_switch import DomainSwitchRequest, DomainSwitchAnalysis
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
import os

router = APIRouter(prefix="/domain_switch", tags=["domain_switch"])

api_key = os.getenv("GROQ_API_KEY")
model = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)

prompt = PromptTemplate(
    input_variables=["user_info_json", "target_domain"],
    template="""
You are an expert career mentor and hiring strategist.

USER PROFILE (JSON):
{user_info_json}

TARGET DOMAIN:
{target_domain}

Analyze whether this domain transition is realistic and beneficial.

Guidelines:
- Be honest, practical, and personalized
- Consider current hiring trends
- Give realistic timelines
- Avoid generic advice

Return the response as valid JSON matching the provided schema.
"""
)

@router.post("/")
async def domain_switch(data: DomainSwitchRequest, request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")
    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

        response = supabase.rpc("get_full_candidate_profile", {"p_user_id": int(user_id)}).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        structured_model = model.with_structured_output(DomainSwitchAnalysis)
        structured_chain = prompt | structured_model
        result = structured_chain.invoke({
            "user_info_json": response.data,
            "target_domain": data.target_domain,
        })
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))