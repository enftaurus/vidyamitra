"""
Mock HR Round — self-contained question generation with progressive difficulty.
No lock enforcement, no leaderboard recording, ultra-detailed mock analysis.
Max 10 questions per session, starting easy and getting progressively deeper.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
import os
import json
from typing import Any

from models.hr_round import HRInterviewState, final_analysis, hr_model_result, hr_answer_request
from services.db_client import supabase
from services.redis import redis_client

api_key = os.getenv("GROQ_API_KEY")
_MOCK_STATE_FALLBACK: dict[str, dict[str, Any]] = {}

MOCK_MAX_QUESTIONS = 10

router = APIRouter(prefix="/mock/hr", tags=["mock_interview"])

model = ChatGroq(temperature=0.6, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
structured_model = model.with_structured_output(hr_model_result)


def _single_question_text(text: str) -> str:
    cleaned = " ".join(str(text or "").split())
    if not cleaned:
        return ""
    if "?" in cleaned:
        return f"{cleaned.split('?', 1)[0].strip()}?"
    return cleaned


def _state_key(user_id: str) -> str:
    return f"mock_hr_state:{user_id}"


def _save_state(user_id: str, state: HRInterviewState, request: Request) -> None:
    key = _state_key(user_id)
    parsed = json.loads(json.dumps(jsonable_encoder(state)))
    _MOCK_STATE_FALLBACK[key] = parsed
    try:
        redis_client.set(key, json.dumps(parsed), ex=7200)
    except Exception:
        pass


def _load_state(user_id: str, request: Request) -> HRInterviewState | None:
    key = _state_key(user_id)
    try:
        raw = redis_client.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return _MOCK_STATE_FALLBACK.get(key)


def _clear_state(user_id: str, request: Request) -> None:
    key = _state_key(user_id)
    _MOCK_STATE_FALLBACK.pop(key, None)
    try:
        redis_client.delete(key)
    except Exception:
        pass


def _generate_next_question(state: HRInterviewState) -> HRInterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1

    if len(qa) >= MOCK_MAX_QUESTIONS:
        state["next_question"] = (
            "That wraps up your mock HR practice session! It was wonderful speaking with you. "
            f"You've completed all {MOCK_MAX_QUESTIONS} questions — review your detailed coaching feedback below. Best of luck!"
        )
        state["action"] = "end_interview"
        state["should_end"] = True
        return state

    if len(qa) == 0:
        prompt = f"""
You are a friendly HR interview coach running a mock practice session.
Start with a gentle warm-up question to help the candidate feel comfortable.

CANDIDATE PROFILE:
{candidate_profile}

INSTRUCTIONS:
- Ask exactly ONE simple, comfortable opener question — like "Tell me about yourself" or "Walk me through your background."
- Keep the tone warm, approachable, and encouraging.
- Do NOT asked anything complex or behavioral on the first question.
- Output only the question text (no preamble, no numbering).
"""
        response = model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.content)
        state["action"] = "keep_difficulty"
        state["should_end"] = False

    else:
        difficulty_stage = "basic" if question_number <= 3 else "behavioral" if question_number <= 7 else "deep_behavioral"
        prompt = f"""
You are an HR interview coach running a mock practice session with progressive depth.

CANDIDATE PROFILE:
{candidate_profile}

PREVIOUS QUESTIONS AND ANSWERS:
{qa}

Current Question Number: {question_number} / {MOCK_MAX_QUESTIONS}
Difficulty Stage: {difficulty_stage}

INSTRUCTIONS:
- Review the candidate's most recent answer leniently — this is a practice session.
- Only end the interview if absolutely necessary (prefer continuing for full coverage).
- For difficulty stage:
  * basic (Q1-3): Simple intro questions, self-description, basic motivations
  * behavioral (Q4-7): Situation-based questions (conflict, leadership, failure, teamwork) using STAR format
  * deep_behavioral (Q8-10): High-pressure deep introspective questions: values, difficult tradeoffs, professional growth, career vision
- Cover different topics each question. Never repeat or rephrase an already-asked question.
- Keep tone professional but approachable.
- Do NOT give feedback in the question itself.
- Output ONLY the structured hr_model_result response.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.next_question or "")
        state["should_end"] = response.should_end
        state["action"] = response.action

    return state


def _mock_analysis_of_interview(state: HRInterviewState) -> dict:
    analysis_model = ChatGroq(
        model_name="llama-3.3-70b-versatile", temperature=0.3, groq_api_key=api_key
    )
    structured_analysis = analysis_model.with_structured_output(final_analysis)

    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]

    prompt = f"""
You are a senior HR manager and executive coach reviewing a candidate's mock HR interview practice session.
Write an extremely detailed, honest, human-like review that the candidate will use to substantially improve.

==============================
CANDIDATE PROFILE:
{candidate_profile}
==============================
QUESTIONS AND ANSWERS FROM THE MOCK SESSION:
{qa}
==============================

Your analysis MUST include:

1. For EACH question asked:
   - What the candidate actually said (paraphrase their answer closely and specifically)
   - What the IDEAL answer should have been — write 2-4 sentences showing a clear, structured, confident model response
   - The specific gap: what was missing (e.g. no STAR structure, too vague, lacked ownership, defensive tone)
   - A rating for that answer out of 10
   - One or two concrete improvement tips for that specific question

2. OVERALL COMMUNICATION EVALUATION:
   - Communication score (1-10): Clarity, confidence, structure
   - Professionalism score (1-10): Tone, maturity, ownership
   - Top 3 STRENGTHS observed across the interview with specific examples from their answers
   - Top 3 WEAKNESSES with exact, actionable improvement steps:
     e.g. "When asked about conflict resolution, you said 'I just accepted it'. Instead, say 'I proactively approached my team lead with a solution and followed up with a written agreement to ensure alignment.'"
   - Overall score out of 100
   - Top areas to work on before the next real HR interview

3. HIRING RECOMMENDATION:
   Write a 2-3 sentence internal HR assessment as if you personally interviewed this candidate and are writing it for the hiring decision.
   Be honest about cultural fit, maturity, and communication readiness.

Be direct, compassionate but honest. Do not sugarcoat poor answers.
Every weakness must have a concrete, specific alternative phrasing or approach.

Return ONLY the structured final_analysis schema. No markdown. No extra commentary.
"""
    result = structured_analysis.invoke([HumanMessage(content=prompt)])
    return result


@router.get("/start")
async def mock_start_hr(request: Request):
    """Start a mock HR interview session — no lock or sequence enforcement."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

        response = supabase.rpc(
            "get_full_candidate_profile", {"p_user_id": int(user_id)}
        ).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User profile not found")

        candidate_profile = response.data

        initial_state: HRInterviewState = {
            "candidate_profile": candidate_profile,
            "questiions_and_answers": [],
            "next_question": "",
            "should_end": False,
            "action": "keep_difficulty",
            "analysis": None,
            "current_answer": "",
        }

        result_state = _generate_next_question(initial_state)
        _save_state(user_id, result_state, request)

        return JSONResponse({
            "question": result_state["next_question"],
            "question_number": 1,
            "should_end": result_state["should_end"],
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer")
async def mock_submit_hr_answer(answer_payload: hr_answer_request, request: Request):
    """Submit answer to current mock HR question. Returns next question or detailed analysis."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

        answer = answer_payload.answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        state: HRInterviewState = _load_state(user_id, request)
        if not state:
            raise HTTPException(
                status_code=400,
                detail="No active mock session. Call /mock/hr/start first.",
            )

        # Record the answer for the current question
        current_q = state.get("next_question", "")
        qa = list(state.get("questiions_and_answers", []))
        qa.append({"question": current_q, "answer": answer})
        state["questiions_and_answers"] = qa
        state["current_answer"] = answer

        result_state = _generate_next_question(state)
        _save_state(user_id, result_state, request)

        question_number = len(result_state["questiions_and_answers"]) + 1

        if result_state.get("should_end") or result_state.get("action") == "end_interview":
            analysis_result = _mock_analysis_of_interview(result_state)
            _clear_state(user_id, request)
            return JSONResponse({
                "should_end": True,
                "closing_note": result_state.get("next_question", "Great practice session! Check your detailed coaching analysis below."),
                "analysis": jsonable_encoder(analysis_result),
            })

        return JSONResponse({
            "question": result_state.get("next_question", ""),
            "question_number": question_number,
            "should_end": False,
            "difficulty": result_state.get("action"),
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
