from fastapi import APIRouter, Request,HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI
from services.db_client import supabase
from services.questions import questions
from services.redis import redis_client
from models.coding_round import solution,analysis
import random 
import os
API_KEY = os.getenv("RESUME_API")
router=APIRouter(prefix="/coding_round",tags=["coding_round"])  
@router.get("/get_question")
def get_question(request:Request):
    user_id=request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        question_id = random.choice(list(questions.keys()))
        redis_client.set(f"user:{user_id}:question", question_id)
        return {"question": questions[question_id]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/submit_solution")
def submit_solution(request:Request,solution:solution):
    user_id=request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        question_id = redis_client.get(f"user:{user_id}:question")
        if not question_id:
            raise HTTPException(status_code=400, detail="No active question found for the user")
        question_id=int(question_id)
        question=questions.get(question_id)
        model=ChatGoogleGenerativeAI(model="gemini-2.5-flash",api_key=API_KEY)
        structured_model=model.with_structured_output(analysis)
        prompt = f"""
You are a very strict competitive programming interviewer and senior software engineer at a top product-based company.
You must evaluate the candidate’s solution harshly and objectively.
Be extremely strict with correctness, edge cases, time complexity, space complexity, logic, syntax, and overall structure.
===============================
PROBLEM STATEMENT:
{question}
===============================
CANDIDATE SUBMISSION:
Code:
{solution.code}
Programming Language:
{solution.language}
Time Taken (seconds):
{solution.time_taken}
===============================
STRICT EVALUATION RULES:
1. If the solution is logically incorrect or fails obvious edge cases → score must be BELOW 40.
2. If the solution works for normal cases but misses important edge cases → score between 40–65.
3. If the solution is correct but not optimal → score between 65–80.
4. ONLY if the solution is fully correct, handles edge cases properly, and is optimal in time & space complexity → score above 85.
5. Never award above 95 unless the solution is exceptionally clean, optimal, and well-structured.
6. Be very strict about:
   - Logical mistakes
   - Missing edge cases
   - Unnecessary loops
   - Inefficient complexity
   - Poor variable naming
   - Lack of clarity
   - Bad formatting
SCORING DISTRIBUTION (Total = 100):
- Correctness: 40 points
- Time & Space Complexity: 25 points
- Edge Case Handling: 15 points
- Code Quality & Readability: 15 points
- Optimization & Clean Structure: 5 points
IMPORTANT:
- Do NOT assume correctness without reasoning.
- Clearly explain why points are deducted.
- Be direct and professional.
- Do not be overly polite.
Return your response STRICTLY in the format of the Pydantic model "analysis" defined in models/coding_round.py.
Do NOT return markdown.
Do NOT add extra commentary.
Return only structured output.
"""
        response=structured_model.invoke(prompt)
        formatted_response=response.model_dump()
        return{"analysis": formatted_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))