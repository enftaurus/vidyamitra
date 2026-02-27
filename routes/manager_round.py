from fastapi import APIRouter, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage
from typing import Any
from models.manager_round import (
    manager_model_result,
    ManagerInterviewState,
    final_analysis,
    manager_answer_request,
)
from services.db_client import supabase
from services.redis import redis_client
import os
import json

api_key = os.getenv("RESUME_API")
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=1.0, api_key=api_key)
structured_model = model.with_structured_output(manager_model_result)
_STATE_FALLBACK: dict[str, dict[str, Any]] = {}
MAX_QUESTIONS = 10


def _state_key(user_id: str) -> str:
    return f"manager_interview_state:{user_id}"


def _serialize_state(state: ManagerInterviewState) -> str:
    return json.dumps(jsonable_encoder(state))


def _save_state(user_id: str, state: ManagerInterviewState, request: Request) -> None:
    key = _state_key(user_id)
    request.session["manager_interview_state_key"] = key

    parsed_state = json.loads(_serialize_state(state))
    _STATE_FALLBACK[key] = parsed_state

    try:
        redis_client.set(key, json.dumps(parsed_state), ex=7200)
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

    fallback_state = _STATE_FALLBACK.get(key)
    if fallback_state:
        return fallback_state

    state = request.session.get("manager_interview_state")
    if state:
        return state

    return None


def _clear_state(user_id: str, request: Request) -> None:
    key = _state_key(user_id)
    _STATE_FALLBACK.pop(key, None)
    request.session.pop("manager_interview_state_key", None)
    request.session.pop("manager_interview_state", None)
    try:
        redis_client.delete(key)
    except Exception:
        pass


def initialisation(state: ManagerInterviewState) -> ManagerInterviewState:
    return state


def route_turn(state: ManagerInterviewState) -> ManagerInterviewState:
    return state


def generate_question(state: ManagerInterviewState) -> ManagerInterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1

    if len(qa) >= MAX_QUESTIONS:
        state["next_question"] = (
            "Thank you for your time. We have completed the manager round with 10 questions, "
            "so this round is now closed."
        )
        state["action"] = "end_interview"
        state["should_end"] = True
        return state

    if len(qa) == 0:
        prompt = f"""
You are a hiring manager conducting a strict manager interview.
The focus of this round is projects explanation and problem solving.

CANDIDATE PROFILE:
{candidate_profile}

INSTRUCTIONS:
1. Greet the candidate briefly and professionally.
2. Start the manager round.
3. Ask exactly ONE question.
4. The first question must be project-focused (project ownership, design choices, tradeoffs, impact).
5. Keep the question practical and managerial, not purely theoretical.
6. Do not provide feedback or hints.
"""
        response = model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = response.content
        state["action"] = "keep_difficulty"
        state["should_end"] = False
    else:
        question_level = state["action"]
        prompt = f"""
You are a strict hiring manager conducting a manager round.

CANDIDATE PROFILE:
{candidate_profile}

PREVIOUS QUESTIONS AND ANSWERS:
{qa}

Current Difficulty Level: {question_level}
Current Question Number: {question_number} / {MAX_QUESTIONS}

RULES:
1. Evaluate only the most recent answer.
2. Decide action: increase_difficulty / decrease_difficulty / keep_difficulty / end_interview.
3. Keep this round concentrated on:
   - project explanation (architecture, decisions, ownership, outcomes, tradeoffs)
   - problem solving (ambiguity handling, constraints, risk, prioritization)
4. Ask exactly ONE next question if continuing.
5. End if the interview quality is very poor or if question_number > {MAX_QUESTIONS}.
6. Never ask more than {MAX_QUESTIONS} questions total.

If ending:
- should_end = true
- action = "end_interview"
- next_question = null

Return ONLY structured output matching the schema.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = response.next_question or ""
        state["should_end"] = response.should_end
        state["action"] = response.action

    return state


def record_answer(state: ManagerInterviewState) -> ManagerInterviewState:
    qa_entry = {
        "question": state.get("next_question", ""),
        "answer": state.get("current_answer", ""),
    }
    state["questiions_and_answers"].append(qa_entry)
    state["current_answer"] = ""
    return state


def analysis_of_interview(state: ManagerInterviewState) -> ManagerInterviewState:
    analysis_model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", temperature=1.0, api_key=api_key
    )
    structured_analysis = analysis_model.with_structured_output(final_analysis)

    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]

    prompt = f"""
You are evaluating a manager round interview.
Prioritize assessment of project depth, ownership, decision making, stakeholder thinking,
and practical problem-solving ability.

CANDIDATE PROFILE:
{candidate_profile}

QUESTIONS AND ANSWERS:
{qa}

Return ONLY the structured final_analysis schema.
"""
    result = structured_analysis.invoke([HumanMessage(content=prompt)])
    state["analysis"] = result
    return state


def should_end_interview(state: ManagerInterviewState) -> str:
    if state.get("should_end") or state.get("action") == "end_interview":
        return "end"
    return "continue"


def has_current_answer(state: ManagerInterviewState) -> str:
    if state.get("current_answer", "").strip():
        return "has_answer"
    return "ask_only"


def build_interview_graph() -> StateGraph:
    graph = StateGraph(ManagerInterviewState)
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
router = APIRouter(prefix="/manager_round", tags=["manager_round"])


@router.get("/start")
async def start_interview(request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="RESUME_API is not configured")

        response = supabase.rpc(
            "get_full_candidate_profile", {"p_user_id": int(user_id)}
        ).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        initial_state: ManagerInterviewState = {
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
async def submit_answer(answer_payload: manager_answer_request, request: Request):
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="RESUME_API is not configured")

        answer = answer_payload.answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        state: ManagerInterviewState = _load_state(user_id, request)
        if not state:
            raise HTTPException(
                status_code=400,
                detail="No active manager-round session. Call /manager_round/start first.",
            )

        state["current_answer"] = answer
        result_state = interview_graph.invoke(state)
        _save_state(user_id, result_state, request)

        question_number = len(result_state["questiions_and_answers"]) + 1

        if result_state.get("should_end") or result_state.get("action") == "end_interview":
            _clear_state(user_id, request)
            return JSONResponse(
                {
                    "should_end": True,
                    "closing_note": result_state.get(
                        "next_question",
                        "Thank you for completing the manager round.",
                    ),
                    "analysis": jsonable_encoder(result_state.get("analysis")),
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
