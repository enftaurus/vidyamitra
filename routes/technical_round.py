from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from models.technical_round import model_result, InterviewState, final_analysis
from services.db_client import supabase
import os

api_key = os.getenv("RESUME_API")
model = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=1.0, api_key=api_key)
structured_model = model.with_structured_output(model_result)


# ─────────────────────────────────────────────
# Node: initialise candidate profile into state
# ─────────────────────────────────────────────
def initialisation(state: InterviewState) -> InterviewState:
    """Ensures candidate_profile is present — used as the first node."""
    return state  # profile is already set before graph invocation


# ─────────────────────────────────────────────
# Node: generate next question (or first question)
# ─────────────────────────────────────────────
def generate_question(state: InterviewState) -> InterviewState:
    qa = state["questiions_and_answers"]
    candidate_profile = state["candidate_profile"]
    question_number = len(qa) + 1  # next question number

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
Current Question Number: {question_number} / 10
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
- If question_number >= 10 → must end interview.
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
==============================
Return your response STRICTLY in the structured format of the ModelResult schema.
Do NOT return markdown.
Do NOT include commentary.
Return only structured output.
"""
        response = structured_model.invoke([HumanMessage(content=prompt)])
        state["next_question"] = response.next_question
        state["should_end"] = response.should_end
        state["action"] = response.action

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


# ─────────────────────────────────────────────
# Build the LangGraph graph
# ─────────────────────────────────────────────
def build_interview_graph() -> StateGraph:
    graph = StateGraph(InterviewState)

    # Add nodes
    graph.add_node("initialise", initialisation)
    graph.add_node("generate_question", generate_question)
    graph.add_node("record_answer", record_answer)
    graph.add_node("analyse", analysis_of_interview)

    # Edges
    graph.add_edge(START, "initialise")
    graph.add_edge("initialise", "generate_question")

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
        }

        result_state = interview_graph.invoke(initial_state)

        # Persist state for subsequent turns (use session / DB / cache as needed)
        request.session["interview_state"] = result_state  # requires SessionMiddleware

        return JSONResponse(
            {
                "question": result_state["next_question"],
                "question_number": 1,
                "should_end": result_state["should_end"],
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer")
async def submit_answer(request: Request):
    """
    Submit the candidate's answer to the current question.
    Expects JSON body: { "answer": "<candidate answer text>" }
    Returns next question or final analysis.
    """
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    body = await request.json()
    answer = body.get("answer", "").strip()
    if not answer:
        raise HTTPException(status_code=400, detail="Answer cannot be empty")

    # Restore state from session
    state: InterviewState = request.session.get("interview_state")
    if not state:
        raise HTTPException(
            status_code=400,
            detail="No active interview session. Call /interview/start first.",
        )

    # Inject the candidate's answer and continue the graph
    state["current_answer"] = answer

    # Run record_answer → generate_question (→ analyse if done)
    result_state = interview_graph.invoke(state, {"starting_node": "record_answer"})

    # Persist updated state
    request.session["interview_state"] = result_state

    question_number = len(result_state["questiions_and_answers"]) + 1

    if result_state.get("should_end") or result_state.get("action") == "end_interview":
        return JSONResponse(
            {
                "should_end": True,
                "analysis": result_state.get("analysis"),
            }
        )

    return JSONResponse(
        {
            "question": result_state["next_question"],
            "question_number": question_number,
            "should_end": False,
            "difficulty": result_state.get("action"),
        }
    )