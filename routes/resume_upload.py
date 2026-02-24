from http.client import HTTPException

from fastapi import APIRouter, File, UploadFile,Request
from models.upload_resume import resume_upload
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate
from services.db_client import supabase
import tempfile
import os
import re
import time 
##------------------------------------------------------------------------------------------------------------------
DOMAINS = {
    1: "AI/ML",
    2: "Data Science",
    3: "Web Development",
    4: "Mobile App Development",
    5: "Cybersecurity",
    6: "DevOps & Cloud",
    7: "Blockchain",
    8: "UI/UX Design",
    9: "Game Development",
    10: "Embedded Systems",
    11: "IoT",
    12: "Robotics",
    13: "EEE",
    14: "ECE",
    15: "Mechanical Engineering",
    16: "Civil Engineering",
    17: "Chemical Engineering",
    18: "Core Engineering"
}
domain_text = "\n".join([f"{k} - {v}" for k, v in DOMAINS.items()])
##------------------------------------------------------------------------------------------------------------------
##------------------------------------------------------------------------------------------------------------------
api_key=os.getenv("RESUME_API")
model=ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1, google_api_key=api_key)
structured_model=model.with_structured_output(resume_upload)
prompt = f"""
You are an expert resume parsing and evaluation system.
Your task is to extract structured information from the given resume text.
You MUST follow these rules strictly:
1. Extract only information explicitly present in the resume.
2. Do NOT hallucinate or invent missing data.
3. If a section does not exist, return null for that field.
4. If a list section (skills, projects, certificates, education) is empty or not present, return null.
5. Dates must be in ISO format (YYYY-MM-DD) if available.
6. Return clean structured JSON only.
7. Do NOT return explanations.
8. Do NOT return markdown.
9. Do NOT include any text outside the structured output.
10.speak like you are giving a feedback to your friend address the user as you need to improve etc etc 
-------------------------
Extract the following fields:
BASIC INFORMATION:
- phone
- bio (If not explicitly present, generate a concise professional bio strictly from resume content.)
- resume_json (structured JSON representation of resume sections)
EDUCATION:
For each education entry extract:
- degree
- field_of_study
- college_name
- university_name
- gpa
- start_year
- end_year
CERTIFICATES:
For each certification extract:
- certificate_name
- certificate_issuer
- certificate_date (YYYY-MM-DD if available, otherwise null)
PROJECTS:
For each project extract:
- project_name
- project_description
- project_link (if available, otherwise null)
SKILLS:
Extract individual technical skills as separate entries.
Avoid duplicates.
Keep original order of appearance if possible.
-------------------------
DOMAIN CLASSIFICATION:
Based strictly on the candidate’s skills, education, and projects,
select ONLY ONE primary domain from the list below:
{domain_text}
Return:
- domain_id (integer only, must match one of the IDs above)
If no clear domain can be identified, return core engineering.
-------------------------
EVALUATION SECTION:
Provide:
- analysis:
  A short interviewer-style evaluation of the resume.
  Mention strengths and weaknesses.
- resume_score:
  Score out of 100 based on:
  structure, clarity, impact, ATS optimization, technical depth, and presentation.
- skill_analysis:
  Based on the selected domain, suggest what skills the candidate should improve.
  If the candidate is strong and industry-ready, say:
  "You are good to go."
- suggested_projects:
  Suggest 2-4 strong project ideas relevant to the domain to improve job opportunities.
  If already strong, say:
  "You are good to go."
-------------------------
If the text is not a valid resume, return an empty JSON object.
Return structured output now.
"""
##------------------------------------------------------------------------------------------------------------------
def clean_resume_text(text: str) -> str:
    text=text.replace("\r", "\n")
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    lines=text.split("\n")
    cleaned_lines=[]
    prev_line=""
    for line in lines:
        line=line.strip()
        if line and line!=prev_line:
            cleaned_lines.append(line)
        prev_line=line
    text="\n".join(cleaned_lines)
    parts=text.split("\n\n")
    unique_parts=list(dict.fromkeys(parts))
    text="\n\n".join(unique_parts)
    return text.strip()
##------------------------------------------------------------------------------------------------------------------
##------------------------------------------------------------------------------------------------------------------
router = APIRouter(prefix="/resume", tags=["Resume Upload"])
@router.post("/")
def upload_resume(request:Request,file: UploadFile = File(...)):
    user_id=request.cookies.get("user_id")
    start_time=time.time()
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp.write(file.file.read())
        tmp_path = tmp.name
    try:
        loader = PyPDFLoader(tmp_path)
        pages = loader.load()
        full_text = "\n".join(page.page_content for page in pages)
        cleaned_text = clean_resume_text(full_text)
        response=structured_model.invoke(f"{prompt}\n\n resume_text:{cleaned_text}")
        json_response=response.model_dump()
        result = supabase.rpc(
            "upsert_full_resume",
            {
                "p_user_id":user_id,
                "data": json_response
            }
        ).execute()
        #return {"message": "Resume uploaded and processed successfully", "data": json_response}
        list=["analysis","resume_score","skill_analysis","suggested_projects"]
        ai_analysis={}
        for k in json_response.keys():
            if k in list:
                ai_analysis[k]=json_response[k]
        end_time=time.time()
        latency=end_time-start_time
        #print(json_response)
        return {"message": "Resume uploaded and processed successfully", "data": ai_analysis, "processing_time": latency}
    except Exception as e:
        return {"error": str(e)}
    finally:
        os.remove(tmp_path)
##------------------------------------------------------------------------------------------------------------------
# def validate_resume(text: str) -> bool:
#     resume_keywords = [
#         "education",
#         "experience",
#         "skills",
#         "employment",
#         "profile",
#         "projects",
#         "certification",
#     ]
#     text_lower = text.lower()
#     return any(keyword in text_lower for keyword in resume_keywords)
