from fastapi import APIRouter,Request,HTTPException,Cookie
from services.db_client import supabase
from models.domain_switch import DomainSwitchRequest,DomainSwitchAnalysis
from routes.resume_upload import model 
from langchain_core.prompts import PromptTemplate
router=APIRouter()
 

from langchain_core.prompts import PromptTemplate

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

@router.post("/domain_switch")
async def domain_switch(data:DomainSwitchRequest,user_id :int=Cookie(None)):
    if not user_id:
        raise HTTPException(status_code=401,detail="User not logged in")
    try:
        response=supabase.rpc("get_full_candidate_profile",{"p_user_id":int(user_id)}).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")
        structered_model = model.with_structured_output(DomainSwitchAnalysis)
        structured_chain = prompt |  structered_model
        result = structured_chain.invoke({
             "user_info_json": response.data,
              "target_domain": data.target_domain
              })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))