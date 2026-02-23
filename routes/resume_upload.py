from fastapi import APIRouter, File, UploadFile,Request
from models.upload_resume import resume_upload
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.prompts import ChatPromptTemplate
from services.db_client import supabase
import tempfile
import os
import re
##------------------------------------------------------------------------------------------------------------------
api_key=os.getenv("RESUME_API")
model=ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1, google_api_key=api_key)
structured_model=model.with_structured_output(resume_upload)
prompt='''You are an expert resume parsing system.
Your task is to extract structured information from the given resume text.
You MUST follow these rules strictly:
1. Extract only information explicitly present in the resume.
2. Do NOT hallucinate or invent missing data.
3. If a section does not exist, return null for that field.
4. If a list section (skills, projects, certificates) is empty or not present, return null.
5. Dates must be in ISO format (YYYY-MM-DD) if available.
6. Return clean structured data only.
7. Do NOT return explanations.
8. Do NOT return markdown.
9. Do NOT include any text outside the structured output.
-------------------------
Extract the following fields:
BASIC INFORMATION:
- phone: Phone number of the candidate.
- bio: A short professional summary from the resume. If not explicitly available, generate a concise bio strictly based on resume content.
- resume_json: A structured JSON representation of the resume including summary, education, experience, and other available sections.
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
If a section does not exist, return it as null.
Ensure all extracted values are clean strings.
Remove extra whitespace.
Do not include bullet symbols.
Do not include formatting artifacts.
Return the structured output now.
if you understand the instructions, respond with only the structured output without any explanations.
if you do not understand the instructions, or the sent text is not a valid resume, respond with an empty JSON object.'''
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
router = APIRouter(prefix="/resume", tags=["Resume Upload"])
@router.post("/")
def upload_resume(request:Request,file: UploadFile = File(...)):
    user_id=request.cookies.get("user_id")
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
        return {"message": "Resume uploaded and processed successfully", "data": json_response}
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
