"""
Mock Technical Round — self-contained question generation with progressive difficulty.
No lock enforcement, no leaderboard recording, ultra-detailed mock analysis.
Max 10 questions per session, starting easy and getting progressively harder.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
import os
import json
from typing import Any

from models.technical_round import InterviewState, final_analysis, model_result, interview_answer_request
from services.db_client import supabase
from services.redis import redis_client

api_key = os.getenv("GROQ_API_KEY")
_MOCK_STATE_FALLBACK: dict[str, dict[str, Any]] = {}

MOCK_MAX_QUESTIONS = 10

router = APIRouter(prefix="/mock/technical", tags=["mock_interview"])

model = ChatGroq(temperature=0.6, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
structured_model = model.with_structured_output(model_result)


def _single_question_text(text: str) -> str:
    cleaned = " ".join(str(text or "").split())
    if not cleaned:
        return ""
    if "?" in cleaned:
        return f"{cleaned.split('?', 1)[0].strip()}?"
    return cleaned


def _state_key(user_id: str) -> str:
    return f"mock_technical_state:{user_id}"


def _save_state(user_id: str, state: InterviewState, request: Request) -> None:
    key = _state_key(user_id)
    parsed = json.loads(json.dumps(jsonable_encoder(state)))
    _MOCK_STATE_FALLBACK[key] = parsed
    try:
        redis_client.set(key, json.dumps(parsed), ex=7200)
    except Exception:
        pass


def _load_state(user_id: str, request: Request) -> InterviewState | None:
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


# ── Progressive question generation (NOT the real-round graph) ────────────

def _generate_next_question(state: InterviewState) -> InterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1

    if len(qa) >= MOCK_MAX_QUESTIONS:
        state["next_question"] = (
            "That wraps up this mock technical round! It was great practicing with you. "
            f"You've completed all {MOCK_MAX_QUESTIONS} questions — check your detailed coaching feedback below. Best of luck!"
        )
        state["action"] = "end_interview"
        state["should_end"] = True
        return state

    if len(qa) == 0:
        # Very first question: warm, simple, introductory
        prompt = f"""
You are a friendly technical interview coach running a mock practice session.
The candidate is warming up, so start gently to build confidence.

CANDIDATE PROFILE:
{candidate_profile}

INSTRUCTIONS:
- Ask exactly ONE simple, beginner-friendly warm-up question.
- Prefer something like "Tell me about a project you're proud of and the tech stack you used"
  or a basic definitional question on a skill they list (e.g. "What is the difference between a list and a dict in Python?").
- Keep the tone approachable and encouraging, not intimidating.
- Do NOT ask multiple questions.
- Output only the question text (no preamble, no numbering).
"""
        response = model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.content)
        state["action"] = "keep_difficulty"
        state["should_end"] = False

    else:
        # Progressive difficulty: early questions easy, later questions harder
        difficulty_stage = "beginner" if question_number <= 3 else "intermediate" if question_number <= 7 else "advanced"
        prompt = f"""
You are a technical interview coach running a mock practice session with progressive difficulty.
The session goes from easy to harder as questions progress.

CANDIDATE PROFILE:
{candidate_profile}

PREVIOUS QUESTIONS AND ANSWERS:
{qa}

Current Question Number: {question_number} / {MOCK_MAX_QUESTIONS}
Difficulty Stage: {difficulty_stage}

INSTRUCTIONS:
- Critically but kindly evaluate the most recent answer.
- Decide if the interview should end (only if truly necessary — this is a mock, try to ask all {MOCK_MAX_QUESTIONS} questions for full coverage).
- For difficulty stage:
  * beginner (Q1-3): Focus on fundamentals, definitions, simple concepts
  * intermediate (Q4-7): Focus on application, how things work, tradeoffs, common use cases
  * advanced (Q8-10): Focus on system design considerations, edge cases, performance, deep reasoning
- Pick a different topic each question. Avoid repeating any already-asked question.
- Do NOT greet, do NOT give feedback in the question itself.
- Output ONLY the structured model_result response.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.next_question or "")
        state["should_end"] = response.should_end
        state["action"] = response.action

    state["core_topic_questions_asked"] = state.get("core_topic_questions_asked", 0)
    return state


# ── Mock analysis (ultra-detailed) ────────────────────────────────────────

def _mock_analysis_of_interview(state: InterviewState) -> dict:
    analysis_model = ChatGroq(
        model_name="llama-3.3-70b-versatile", temperature=0.3, groq_api_key=api_key
    )
    structured_analysis = analysis_model.with_structured_output(final_analysis)

    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]

    prompt = f"""
You are a senior software engineer and technical interview coach reviewing a candidate's mock practice session.
Your job is to write an extremely detailed, human-like review that the candidate will use to improve.

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
   - What the IDEAL answer should have been (write 2-4 sentences of the model answer)
   - The specific gap between what they said and what was expected
   - A rating for that answer out of 10
   - One or two concrete improvement tips specific to that question

2. OVERALL EVALUATION:
   - Communication score (1-10): Was the candidate clear, structured, and confident?
   - Technical depth score (1-10): Did they demonstrate strong foundational knowledge?
   - Top 3 STRENGTHS shown across the entire interview, with specific quotes or moments from their answers
   - Top 3 WEAKNESSES with exact, actionable improvement steps — e.g. "When asked about X, you said Y. Instead, say Z."
   - Overall score out of 100
   - Areas to focus on before the next interview

3. HIRING RECOMMENDATION:
   Write a 2-3 sentence internal hiring recommendation as if you personally interviewed this candidate and are writing it for the hiring committee.

This must feel like a senior engineer wrote it personally after sitting through the entire interview.
Be direct, specific, constructive, and honest. Do not sugarcoat weak answers.
Do NOT be vague. Every weakness must have a concrete fix.

Return ONLY the structured final_analysis schema. No markdown. No extra commentary.
"""
    result = structured_analysis.invoke([HumanMessage(content=prompt)])
    return result


# ── Routes ─────────────────────────────────────────────────────────────────

@router.get("/start")
async def mock_start_interview(request: Request):
    """Start a mock technical interview session — no lock or sequence enforcement."""
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

        initial_state: InterviewState = {
            "candidate_profile": candidate_profile,
            "questiions_and_answers": [],
            "next_question": "",
            "should_end": False,
            "action": "keep_difficulty",
            "analysis": None,
            "current_answer": "",
            "core_topic_questions_asked": 0,
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
async def mock_submit_answer(answer_payload: interview_answer_request, request: Request):
    """Submit answer to current mock technical question. Returns next question or detailed analysis."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

        answer = answer_payload.answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        state: InterviewState = _load_state(user_id, request)
        if not state:
            raise HTTPException(
                status_code=400,
                detail="No active mock session. Call /mock/technical/start first.",
            )

        # Record the answer for the current question
        current_q = state.get("next_question", "")
        qa = list(state.get("questiions_and_answers", []))
        qa.append({"question": current_q, "answer": answer})
        state["questiions_and_answers"] = qa
        state["current_answer"] = answer

        # Generate next question or end
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
