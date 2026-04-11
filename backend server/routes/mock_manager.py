"""
Mock Manager Round — self-contained question generation with progressive difficulty.
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

from models.manager_round import ManagerInterviewState, final_analysis, manager_model_result, manager_answer_request
from services.db_client import supabase
from services.redis import redis_client

api_key = os.getenv("GROQ_API_KEY")
_MOCK_STATE_FALLBACK: dict[str, dict[str, Any]] = {}

MOCK_MAX_QUESTIONS = 10

router = APIRouter(prefix="/mock/manager", tags=["mock_interview"])

model = ChatGroq(temperature=0.6, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)
structured_model = model.with_structured_output(manager_model_result)


def _single_question_text(text: str) -> str:
    cleaned = " ".join(str(text or "").split())
    if not cleaned:
        return ""
    if "?" in cleaned:
        return f"{cleaned.split('?', 1)[0].strip()}?"
    return cleaned


def _state_key(user_id: str) -> str:
    return f"mock_manager_state:{user_id}"


def _save_state(user_id: str, state: ManagerInterviewState, request: Request) -> None:
    key = _state_key(user_id)
    parsed = json.loads(json.dumps(jsonable_encoder(state)))
    _MOCK_STATE_FALLBACK[key] = parsed
    try:
        redis_client.set(key, json.dumps(parsed), ex=7200)
    except Exception:
        pass


def _load_state(user_id: str, request: Request) -> ManagerInterviewState | None:
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


def _generate_next_question(state: ManagerInterviewState) -> ManagerInterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1

    if len(qa) >= MOCK_MAX_QUESTIONS:
        state["next_question"] = (
            "That wraps up your mock manager round practice! It was great speaking with you today. "
            f"You've completed all {MOCK_MAX_QUESTIONS} questions — review your detailed coaching feedback below. Best of luck!"
        )
        state["action"] = "end_interview"
        state["should_end"] = True
        return state

    if len(qa) == 0:
        prompt = f"""
You are a friendly hiring manager running a mock interview practice session.
Start with a gentle, open-ended question to put the candidate at ease.

CANDIDATE PROFILE:
{candidate_profile}

INSTRUCTIONS:
- Ask exactly ONE simple opener — like "Walk me through your most recent project" or "Tell me about a project you're proud of."
- Keep the tone conversational and low-pressure for the first question.
- Do NOT ask about difficult tradeoffs or high-pressure decisions in Q1.
- Output only the question text (no preamble, no numbering).
"""
        response = model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.content)
        state["action"] = "keep_difficulty"
        state["should_end"] = False

    else:
        difficulty_stage = "introductory" if question_number <= 3 else "situational" if question_number <= 7 else "strategic"
        prompt = f"""
You are an engineering manager running a mock interview practice session with progressive difficulty.

CANDIDATE PROFILE:
{candidate_profile}

PREVIOUS QUESTIONS AND ANSWERS:
{qa}

Current Question Number: {question_number} / {MOCK_MAX_QUESTIONS}
Difficulty Stage: {difficulty_stage}

INSTRUCTIONS:
- Review the most recent answer fairly — this is a coaching/practice environment.
- Only end the interview if truly necessary (prefer asking all {MOCK_MAX_QUESTIONS} questions for full coverage).
- For difficulty stage:
  * introductory (Q1-3): Project overview, basic responsibility, simple decisions
  * situational (Q4-7): Handling ambiguity, tradeoffs, cross-team collaboration, challenges, failures
  * strategic (Q8-10): High-impact decisions, system-wide thinking, leadership under pressure, metrics and outcomes
- Cover different topics each time and never repeat a question already asked.
- Do NOT give feedback inside the question.
- Output ONLY the structured manager_model_result response.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.next_question or "")
        state["should_end"] = response.should_end
        state["action"] = response.action

    return state


def _mock_analysis_of_interview(state: ManagerInterviewState) -> dict:
    analysis_model = ChatGroq(
        model_name="llama-3.3-70b-versatile", temperature=0.3, groq_api_key=api_key
    )
    structured_analysis = analysis_model.with_structured_output(final_analysis)

    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]

    prompt = f"""
You are a senior engineering manager and executive coaching expert reviewing a candidate's mock manager-round interview practice session.
Write an extremely detailed, honest, constructive analysis that the candidate will use to improve before their real interview.

==============================
CANDIDATE PROFILE:
{candidate_profile}
==============================
QUESTIONS AND ANSWERS FROM THE MOCK SESSION:
{qa}
==============================

Your analysis MUST include:

1. For EACH question asked:
   - What the candidate actually said (paraphrase closely and specifically)
   - What the IDEAL answer should have been — provide a 3-5 sentence model answer demonstrating ownership, clarity, data-driven reasoning, and stakeholder thinking
   - The specific gap (e.g. vague on impact, no metrics, did not mention tradeoffs, lacked ownership, missed the "why")
   - A rating for that answer out of 10
   - Concrete improvement tip: Exact alternative phrases or frameworks they should use (e.g. STAR, situation-action-result, or specific vocabulary like "I drove X by doing Y, resulting in Z")

2. OVERALL EVALUATION:
   - Project ownership score (1-10): Did they clearly own outcomes and decisions?
   - Problem-solving clarity score (1-10): Were their thought processes structured and data-aware?
   - Top 3 STRENGTHS with specific examples from their actual answers
   - Top 3 WEAKNESSES with exact, actionable improvement scripts:
     e.g. "When asked about a project decision, you said 'I just followed the plan'. Instead, say 'I evaluated options A and B considering latency vs. cost, and chose B because it reduced failure rate by 40% which was our primary KPI.'"
   - Overall score out of 100
   - Critical areas to master before the real manager round

3. HIRING RECOMMENDATION:
   Write a 2-3 sentence executive hiring assessment as if you personally ran this manager-round interview.
   Be honest about leadership potential, project thinking maturity, and whether this candidate shows manager readiness.

Be direct and specific. Every weakness must include exact language the candidate can rehearse.
Do not sugarcoat weak answers. This is a coaching tool, not a feel-good report.

Return ONLY the structured final_analysis schema. No markdown. No extra commentary.
"""
    result = structured_analysis.invoke([HumanMessage(content=prompt)])
    return result


@router.get("/start")
async def mock_start_manager(request: Request):
    """Start a mock manager interview — no lock or sequence enforcement."""
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

        initial_state: ManagerInterviewState = {
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
async def mock_submit_manager_answer(answer_payload: manager_answer_request, request: Request):
    """Submit answer to current mock manager question. Returns next question or detailed analysis."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

        answer = answer_payload.answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        state: ManagerInterviewState = _load_state(user_id, request)
        if not state:
            raise HTTPException(
                status_code=400,
                detail="No active mock session. Call /mock/manager/start first.",
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
