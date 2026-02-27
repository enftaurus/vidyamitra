from fastapi import APIRouter, Request, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage
from typing import Any
from models.technical_round import model_result, InterviewState, final_analysis, interview_answer_request
from services.db_client import supabase
from services.redis import redis_client
import os
import json

api_key = os.getenv("RESUME_API")
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=1.0, api_key=api_key)
structured_model = model.with_structured_output(model_result)
_STATE_FALLBACK: dict[str, dict[str, Any]] = {}
CORE_TOPICS = ["Computer Networks", "DBMS", "OOPS"]
MAX_QUESTIONS = 10
MIN_CORE_TOPIC_QUESTIONS = 2


def _state_key(user_id: str) -> str:
    return f"interview_state:{user_id}"


def _serialize_state(state: InterviewState) -> str:
    return json.dumps(jsonable_encoder(state))


def _save_state(user_id: str, state: InterviewState, request: Request) -> None:
    key = _state_key(user_id)
    request.session["interview_state_key"] = key

    parsed_state = json.loads(_serialize_state(state))
    _STATE_FALLBACK[key] = parsed_state

    try:
        redis_client.set(key, json.dumps(parsed_state), ex=7200)
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

    fallback_state = _STATE_FALLBACK.get(key)
    if fallback_state:
        return fallback_state

    # Backward compatibility: support old session-stored state if present.
    state = request.session.get("interview_state")
    if state:
        return state

    return None


def _clear_state(user_id: str, request: Request) -> None:
    key = _state_key(user_id)
    _STATE_FALLBACK.pop(key, None)
    request.session.pop("interview_state_key", None)
    request.session.pop("interview_state", None)
    try:
        redis_client.delete(key)
    except Exception:
        pass


# ─────────────────────────────────────────────
# Node: initialise candidate profile into state
# ─────────────────────────────────────────────
def initialisation(state: InterviewState) -> InterviewState:
    """Ensures candidate_profile is present — used as the first node."""
    return state  # profile is already set before graph invocation


def route_turn(state: InterviewState) -> InterviewState:
    """Routing node to decide whether this invocation has a fresh answer."""
    return state


# ─────────────────────────────────────────────
# Node: generate next question (or first question)
# ─────────────────────────────────────────────
def generate_question(state: InterviewState) -> InterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1  # next question number
    core_topic_questions_asked = int(state.get("core_topic_questions_asked", 0))

    if len(qa) >= MAX_QUESTIONS:
        state["next_question"] = (
            "Thank you for completing the technical interview. "
            "We have reached the maximum of 10 questions, so this round is now concluded."
        )
        state["action"] = "end_interview"
        state["should_end"] = True
        return state

    if len(qa) == 0:
        # ── First question ──────────────────────────────────────────────
        prompt = f"""
You are a strict and professional technical interviewer at a top product-based company.
You are starting a structured technical mock interview.
The following is the complete candidate profile (resume content).
Read it carefully and use it to guide your questioning strategy.
---------------------------
CANDIDATE PROFILE:
{candidate_profile}
---------------------------
INSTRUCTIONS:
1. Greet the candidate by name (if name is present in the profile).
2. Clearly state that the technical interview is beginning.
3. Inform the candidate that you will start from fundamentals and adjust difficulty based on performance.
4. Carefully analyze the resume and identify:
   - Core programming languages
   - Main technical skills
   - Notable projects
   - Areas of claimed expertise
5. Start with a basic foundational question related to one of the candidate's claimed skills.
6. Do NOT ask advanced or system design questions yet.
7. Do NOT evaluate or score anything yet.
8. Ask only ONE question.
9. Keep tone professional, serious, and interview-like.
10. Keep the first question at EASY difficulty level.
Avoid:
- Giving feedback
- Giving hints
- Asking multiple questions
- Asking unrelated topics not mentioned in the profile
Generate:
- A short greeting
- A short introduction line
- The first technical question
"""
        response = model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = response.content
        state["action"] = "keep_difficulty"
        state["should_end"] = False

    else:
        # ── Subsequent questions ────────────────────────────────────────
        question_level = state["action"]
        remaining_questions = MAX_QUESTIONS - len(qa)
        remaining_core_needed = max(0, MIN_CORE_TOPIC_QUESTIONS - core_topic_questions_asked)
        force_core_topic = remaining_core_needed > 0 and (
            question_number in (3, 6) or remaining_questions <= remaining_core_needed
        )
        forced_topic = CORE_TOPICS[core_topic_questions_asked % len(CORE_TOPICS)] if force_core_topic else ""

        prompt = f"""
You are a highly strict and critical technical interviewer at a top product-based company.
You are conducting a structured technical mock interview.
==============================
CANDIDATE PROFILE:
{candidate_profile}
==============================
PREVIOUS QUESTIONS AND ANSWERS:
{qa}
==============================
Current Difficulty Level: {question_level}
Current Question Number: {question_number} / {MAX_QUESTIONS}
Core CS Questions Already Asked (CN/DBMS/OOPS): {core_topic_questions_asked}
==============================
Your Responsibilities:
1. Critically evaluate the candidate's most recent answer.
2. Decide whether the candidate demonstrated:
   - Weak understanding
   - Average understanding
   - Strong understanding
3. Based on performance, decide:
   - Whether to increase difficulty
   - Decrease difficulty
   - Keep same difficulty
   - End interview
4. Decide whether the interview should end.
5. If continuing, generate the next question.
==============================
DIFFICULTY RULES:
- If answer shows weak understanding → action = "decrease_difficulty"
- If answer shows moderate understanding → action = "keep_difficulty"
- If answer shows strong understanding → action = "increase_difficulty"
If the candidate repeatedly shows poor understanding, you may:
action = "end_interview"
should_end = true
==============================
STOP RULES:
- If question_number > {MAX_QUESTIONS} → must end interview immediately.
- Do NOT randomly end interview without performance reason.
If ending interview:
- should_end = true
- next_question = null
- action = "end_interview"
If continuing:
- should_end = false
- Generate exactly ONE next technical question.
- The question must match the updated difficulty level.
- Do NOT give feedback.
- Do NOT explain reasoning.
- Do NOT ask multiple questions.
CORE TOPIC COVERAGE RULE:
- Across the full interview, at least {MIN_CORE_TOPIC_QUESTIONS} questions must be from CN/DBMS/OOPS.
- If force_core_topic is true ({force_core_topic}), the next question MUST be on this topic: {forced_topic}.
==============================
Return your response STRICTLY in the structured format of the ModelResult schema.
Do NOT return markdown.
Do NOT include commentary.
Return only structured output.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = response.next_question or ""
        state["should_end"] = response.should_end
        state["action"] = response.action

        if state["should_end"] and remaining_core_needed > 0 and len(qa) < MAX_QUESTIONS:
            topic_to_cover = CORE_TOPICS[core_topic_questions_asked % len(CORE_TOPICS)]
            forced_prompt = f"""
You are a strict technical interviewer.
Ask exactly one interview question at {question_level} difficulty on {topic_to_cover}.
Do not give feedback. Do not ask multiple questions. Output only the question text.
"""
            forced_response = model.invoke([HumanMessage(content=forced_prompt)])
            state["next_question"] = forced_response.content
            state["should_end"] = False
            state["action"] = "keep_difficulty"
            state["core_topic_questions_asked"] = core_topic_questions_asked + 1
            return state

        if force_core_topic and not state["should_end"]:
            state["core_topic_questions_asked"] = core_topic_questions_asked + 1

    return state


# ─────────────────────────────────────────────
# Node: record the candidate's answer into state
# ─────────────────────────────────────────────
def record_answer(state: InterviewState) -> InterviewState:
    """
    Appends the latest question + answer pair to questiions_and_answers.
    The answer must have been written into state['current_answer'] before
    this node is called.
    """
    qa_entry = {
        "question": state.get("next_question", ""),
        "answer": state.get("current_answer", ""),
    }
    state["questiions_and_answers"].append(qa_entry)
    state["current_answer"] = ""  # reset for next round
    return state


# ─────────────────────────────────────────────
# Node: final analysis after interview ends
# ─────────────────────────────────────────────
def analysis_of_interview(state: InterviewState) -> InterviewState:
    analysis_model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash", temperature=1.0, api_key=api_key
    )
    structured_analysis = analysis_model.with_structured_output(final_analysis)

    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]

    prompt = f"""
You are an expert technical interview evaluator.
Analyze the complete interview session below and produce a comprehensive final evaluation.

==============================
CANDIDATE PROFILE:
{candidate_profile}
==============================
QUESTIONS AND ANSWERS:
{qa}
==============================

Your evaluation must include:
1. Overall performance score (0-10)
2. Strengths demonstrated
3. Weaknesses / gaps identified
4. Recommended topics to study
5. Final hiring recommendation: Strong Yes / Yes / Maybe / No

Return ONLY the structured final_analysis schema. No markdown. No extra commentary.
"""
    result = structured_analysis.invoke([HumanMessage(content=prompt)])
    state["analysis"] = result
    return state


# ─────────────────────────────────────────────
# Conditional edge: should the interview end?
# ─────────────────────────────────────────────
def should_end_interview(state: InterviewState) -> str:
    if state.get("should_end") or state.get("action") == "end_interview":
        return "end"
    return "continue"


def has_current_answer(state: InterviewState) -> str:
    if state.get("current_answer", "").strip():
        return "has_answer"
    return "ask_only"


# ─────────────────────────────────────────────
# Build the LangGraph graph
# ─────────────────────────────────────────────
def build_interview_graph() -> StateGraph:
    graph = StateGraph(InterviewState)

    # Add nodes
    graph.add_node("initialise", initialisation)
    graph.add_node("route_turn", route_turn)
    graph.add_node("generate_question", generate_question)
    graph.add_node("record_answer", record_answer)
    graph.add_node("analyse", analysis_of_interview)

    # Edges
    graph.add_edge(START, "initialise")
    graph.add_edge("initialise", "route_turn")

    graph.add_conditional_edges(
        "route_turn",
        has_current_answer,
        {
            "has_answer": "record_answer",
            "ask_only": "generate_question",
        },
    )

    # After generating a question we wait for an answer (record_answer is
    # called explicitly per-turn; see interview_answer endpoint below).
    # The graph is re-invoked each turn, so we model a single turn as:
    #   generate_question → conditional check → analyse / END
    graph.add_conditional_edges(
        "generate_question",
        should_end_interview,
        {
            "end": "analyse",
            "continue": END,   # pause; next turn starts at record_answer
        },
    )

    graph.add_edge("record_answer", "generate_question")
    graph.add_edge("analyse", END)

    return graph.compile()


interview_graph = build_interview_graph()


# ─────────────────────────────────────────────
# FastAPI Router
# ─────────────────────────────────────────────
router = APIRouter(prefix="/interview", tags=["mock_interview"])


@router.get("/start")
async def start_interview(request: Request):
    """Start a new interview session — returns the first question."""
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
async def submit_answer(answer_payload: interview_answer_request, request: Request):
    """
    Submit the candidate's answer to the current question.
    Expects JSON body: { "answer": "<candidate answer text>" }
    Returns next question or final analysis.
    """
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    try:
        if not api_key:
            raise HTTPException(status_code=500, detail="RESUME_API is not configured")

        answer = answer_payload.answer.strip()
        if not answer:
            raise HTTPException(status_code=400, detail="Answer cannot be empty")

        state: InterviewState = _load_state(user_id, request)
        if not state:
            raise HTTPException(
                status_code=400,
                detail="No active interview session. Call /interview/start first.",
            )

        # Inject the candidate's answer and continue the graph
        state["current_answer"] = answer

        # Re-enter from START; graph routes to record_answer when current_answer exists.
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
                        "Thank you for completing the interview.",
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