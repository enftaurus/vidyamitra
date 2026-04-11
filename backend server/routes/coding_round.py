from fastapi import APIRouter, Request,HTTPException
from langchain_groq import ChatGroq
from services.db_client import supabase
from services.questions import questions
from services.redis import redis_client
from services.leaderboard import record_round_score
from services.round_flow import ensure_round_start_allowed, ensure_round_answer_allowed, set_round_state
from services.job_context import get_active_job, format_job_context_for_prompt
from models.coding_round import solution,analysis
import random 
import os
api_key = os.getenv("GROQ_API_KEY")
router=APIRouter(prefix="/coding_round",tags=["coding_round"])  


@router.get("/get_question")
def get_question(request:Request):
    user_id=request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        can_start, message = ensure_round_start_allowed(str(user_id), "coding")
        if not can_start:
            raise HTTPException(status_code=403, detail=message)
        question_id = random.choice(list(questions.keys()))
        redis_client.set(f"user:{user_id}:question", question_id)
        set_round_state(str(user_id), "coding", "in_progress")
        return {"question": questions[question_id]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/submit_solution")
def submit_solution(request:Request,solution:solution):
    user_id=request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        can_answer, message = ensure_round_answer_allowed(str(user_id), "coding")
        if not can_answer:
            raise HTTPException(status_code=403, detail=message)
        question_id = redis_client.get(f"user:{user_id}:question")
        if not question_id:
            raise HTTPException(status_code=400, detail="No active question found for the user")
        question_id=int(question_id)
        question=questions.get(question_id)
        job = get_active_job(str(user_id))
        job_block = format_job_context_for_prompt(job)
        model = ChatGroq(temperature=0.6, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
        structured_model=model.with_structured_output(analysis)
        prompt = f"""
You are a very strict competitive programming interviewer and senior software engineer at a top product-based company.
You must evaluate the candidate's solution harshly and objectively.
Be extremely strict with correctness, edge cases, time complexity, space complexity, logic, syntax, and overall structure.
{job_block}
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
        set_round_state(str(user_id), "coding", "completed")
        record_round_score(int(user_id), "coding", int(formatted_response.get("overall_score", 0)))
        return{"analysis": formatted_response}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# Mock Coding Round — no enforcement, detailed analysis
# ─────────────────────────────────────────────
mock_router = APIRouter(prefix="/mock/coding", tags=["mock_interview"])


@mock_router.get("/get_question")
def mock_get_question(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        question_id = random.choice(list(questions.keys()))
        redis_client.set(f"mock_user:{user_id}:question", question_id)
        return {"question": questions[question_id]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@mock_router.post("/submit_solution")
def mock_submit_solution(request: Request, solution: solution):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        question_id = redis_client.get(f"mock_user:{user_id}:question")
        if not question_id:
            raise HTTPException(status_code=400, detail="No active mock question found")
        question_id = int(question_id)
        question = questions.get(question_id)
        model = ChatGroq(temperature=0.6, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
        structured_model = model.with_structured_output(analysis)
        prompt = f"""
You are a senior software engineer and competitive programming coach reviewing a candidate's mock coding practice submission.
Write an extremely detailed, human-like coaching analysis the candidate will use to actually improve.

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

Your analysis MUST include:

1. CODE ANALYSIS (be very specific):
   - Is the logic correct? Does it handle the given sample input/output? Show a trace.
   - What edge cases does it miss? Give concrete examples of inputs that would break it.
   - Time complexity and space complexity with reasoning.
   - Specific lines or sections that are problematic — quote the code and explain why.

2. SOLUTION IMPROVEMENT:
   - Write the correct, optimal approach in plain English first (algorithm walkthrough).
   - Then write or describe the corrected/improved code with specific changes.
   - Explain the improved time and space complexity.

3. TIPS FOR THE CANDIDATE:
   - 3-5 specific, actionable tips they should practice based on this submission.
   - For example: "Practice prefix sum patterns", "Always check for empty input", "Use enumerate() instead of manual index tracking in Python".

4. OVERALL ANALYSIS:
   - How would this perform in a real interview? (e.g. "Would fail most test cases", "Correct but O(n²) when O(n) is expected")
   - What does this submission reveal about the candidate's current skill level?
   - What specific topic areas should they study before the real interview?

5. SCORE out of 100:
   - Correctness: 40pts — does it work on normal and edge cases?
   - Time & Space Optimization: 25pts — is it efficient?
   - Edge Case Handling: 15pts — does it cover corner cases?
   - Code Quality: 15pts — clean, readable, properly named?
   - Structure: 5pts — well-organized and idiomatic?

Be direct and specific. Quote actual code. Do not sugarcoat mistakes.
This is a coaching session, not a validation — be as helpful and specific as possible.

Return ONLY the structured analysis schema. No markdown. No extra commentary.
"""
        response = structured_model.invoke(prompt)
        formatted_response = response.model_dump()
        return {"analysis": formatted_response}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))