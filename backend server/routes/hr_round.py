from fastapi import APIRouter, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage
from typing import Any
from models.hr_round import hr_model_result, HRInterviewState, final_analysis, hr_answer_request
from services.db_client import supabase
from services.redis import redis_client
from services.round_flow import ensure_round_start_allowed, ensure_round_answer_allowed, set_round_state, reset_flow_state
import os
import json

api_key = os.getenv("RESUME_API")
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=1.0, api_key=api_key)
structured_model = model.with_structured_output(hr_model_result)
_STATE_FALLBACK: dict[str, dict[str, Any]] = {}
MAX_QUESTIONS = 3


def _single_question_text(text: str) -> str:
    cleaned = " ".join(str(text or "").split())
    if not cleaned:
        return ""
    if "?" in cleaned:
        return f"{cleaned.split('?', 1)[0].strip()}?"
    return cleaned


def _state_key(user_id: str) -> str:
    return f"hr_interview_state:{user_id}"


def _serialize_state(state: HRInterviewState) -> str:
    return json.dumps(jsonable_encoder(state))


def _save_state(user_id: str, state: HRInterviewState, request: Request) -> None:
    key = _state_key(user_id)
    request.session["hr_interview_state_key"] = key

    parsed_state = json.loads(_serialize_state(state))
    _STATE_FALLBACK[key] = parsed_state

    try:
        redis_client.set(key, json.dumps(parsed_state), ex=7200)
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

    fallback_state = _STATE_FALLBACK.get(key)
    if fallback_state:
        return fallback_state

    state = request.session.get("hr_interview_state")
    if state:
        return state

    return None


def _clear_state(user_id: str, request: Request) -> None:
    key = _state_key(user_id)
    _STATE_FALLBACK.pop(key, None)
    request.session.pop("hr_interview_state_key", None)
    request.session.pop("hr_interview_state", None)
    try:
        redis_client.delete(key)
    except Exception:
        pass


def initialisation(state: HRInterviewState) -> HRInterviewState:
    return state


def route_turn(state: HRInterviewState) -> HRInterviewState:
    return state


def generate_question(state: HRInterviewState) -> HRInterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1

    if len(qa) >= MAX_QUESTIONS:
        state["next_question"] = (
            f"Thank you for your time. We have completed the HR round with {MAX_QUESTIONS} questions, "
            "so this round is now closed."
        )
        state["action"] = "end_interview"
        state["should_end"] = True
        return state

    if len(qa) == 0:
        prompt = f"""
You are a professional HR interviewer conducting a personality-focused HR round.

CANDIDATE PROFILE:
{candidate_profile}

INSTRUCTIONS:
0. You have only 3 total questions in this HR round.
1. Do NOT greet. Do NOT add introduction.
2. Ask exactly ONE short and basic HR question.
3. Ask exactly ONE question.
4. Focus on personality traits, communication, teamwork, ownership, adaptability, values, and behavior.
5. Avoid deep technical questions.
6. Do not give feedback or hints.
7. Ask a basic behavioral question with clear wording.
8. Do NOT repeat any question from a previous round or session.
"""
        response = model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.content)
        state["action"] = "keep_difficulty"
        state["should_end"] = False
    else:
        question_level = state["action"]
        prompt = f"""
You are a strict HR interviewer conducting a structured HR round.

CANDIDATE PROFILE:
{candidate_profile}

PREVIOUS QUESTIONS AND ANSWERS:
{qa}

Current Difficulty Level: {question_level}
Current Question Number: {question_number} / {MAX_QUESTIONS}

RULES:
1. Evaluate only the most recent answer.
2. Decide action: increase_difficulty / decrease_difficulty / keep_difficulty / end_interview.
3. Keep this round concentrated on personality and behavioral evaluation:
   - communication clarity
   - teamwork and collaboration
   - conflict handling
   - accountability and ownership
   - adaptability and growth mindset
4. Ask exactly ONE next question if continuing.
5. The next question MUST be completely different from every question listed in PREVIOUS QUESTIONS AND ANSWERS. Never repeat or rephrase an already-asked question.
6. End if the interview quality is very poor or if question_number > {MAX_QUESTIONS}.
7. Never ask more than {MAX_QUESTIONS} questions total.
8. Every asked question must remain short and basic.
9. You only have 3 total questions in this round.

If ending:
- should_end = true
- action = "end_interview"
- next_question = null

Return ONLY structured output matching the schema.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = _single_question_text(response.next_question or "")
        state["should_end"] = response.should_end
        state["action"] = response.action

    return state


def record_answer(state: HRInterviewState) -> HRInterviewState:
    qa_entry = {
        "question": state.get("next_question", ""),
        "answer": state.get("current_answer", ""),
    }
    state["questiions_and_answers"].append(qa_entry)
    state["current_answer"] = ""
    return state


def analysis_of_interview(state: HRInterviewState) -> HRInterviewState:
    analysis_model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", temperature=1.0, api_key=api_key
    )
    structured_analysis = analysis_model.with_structured_output(final_analysis)

    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]

    prompt = f"""
You are evaluating an HR round interview.
Prioritize personality, behavioral maturity, communication, teamwork, ownership,
and cultural alignment.

CANDIDATE PROFILE:
{candidate_profile}

QUESTIONS AND ANSWERS:
{qa}

Return ONLY the structured final_analysis schema.
"""
    result = structured_analysis.invoke([HumanMessage(content=prompt)])
    state["analysis"] = result
    return state


def should_end_interview(state: HRInterviewState) -> str:
    if state.get("should_end") or state.get("action") == "end_interview":
        return "end"
    return "continue"


def has_current_answer(state: HRInterviewState) -> str:
    if state.get("current_answer", "").strip():
        return "has_answer"
    return "ask_only"


def build_interview_graph() -> StateGraph:
    graph = StateGraph(HRInterviewState)
    graph.add_node("initialise", initialisation)
    graph.add_node("route_turn", route_turn)
    graph.add_node("generate_question", generate_question)
    graph.add_node("record_answer", record_answer)
    graph.add_node("analyse", analysis_of_interview)

    graph.add_edge(START, "initialise")
    graph.add_edge("initialise", "route_turn")

    graph.add_conditional_edges(
        "route_turn",
        has_current_answer,
        {"has_answer": "record_answer", "ask_only": "generate_question"},
    )

    graph.add_conditional_edges(
        "generate_question",
        should_end_interview,
        {"end": "analyse", "continue": END},
    )

    graph.add_edge("record_answer", "generate_question")
    graph.add_edge("analyse", END)

    return graph.compile()


interview_graph = build_interview_graph()
router = APIRouter(prefix="/hr_round", tags=["hr_round"])


@router.get("/start")
async def start_interview(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        ensure_round_start_allowed(str(user_id), "hr")

        if not api_key:
            raise HTTPException(status_code=500, detail="RESUME_API is not configured")

        response = supabase.rpc(
            "get_full_candidate_profile", {"p_user_id": int(user_id)}
        ).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        initial_state: HRInterviewState = {
            "candidate_profile": response.data,
            "questiions_and_answers": [],
            "next_question": "",
            "should_end": False,
            "action": "keep_difficulty",
            "analysis": None,
            "current_answer": "",
        }

        result_state = interview_graph.invoke(initial_state)
        _save_state(user_id, result_state, request)
        set_round_state(str(user_id), "hr", "in_progress")

        return JSONResponse(
            {
                "question": result_state["next_question"],
                "question_number": 1,
                "should_end": result_state["should_end"],
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer")
async def submit_answer(answer_payload: hr_answer_request, request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        ensure_round_answer_allowed(str(user_id), "hr")

        if not api_key:
            raise HTTPException(status_code=500, detail="RESUME_API is not configured")

        answer = answer_payload.answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        state: HRInterviewState = _load_state(user_id, request)
        if not state:
            raise HTTPException(
                status_code=400,
                detail="No active HR-round session. Call /hr_round/start first.",
            )

        state["current_answer"] = answer
        result_state = interview_graph.invoke(state)
        _save_state(user_id, result_state, request)

        question_number = len(result_state["questiions_and_answers"]) + 1

        if result_state.get("should_end") or result_state.get("action") == "end_interview":
            _clear_state(user_id, request)
            reset_flow_state(str(user_id))
            return JSONResponse(
                {
                    "should_end": True,
                    "closing_note": result_state.get(
                        "next_question",
                        "Thank you for completing the HR round.",
                    ),
                    "analysis": jsonable_encoder(result_state.get("analysis")),
                    "flow_reset": True,
                }
            )

        return JSONResponse(
            {
                "question": result_state.get("next_question", ""),
                "question_number": question_number,
                "should_end": False,
                "difficulty": result_state.get("action"),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
