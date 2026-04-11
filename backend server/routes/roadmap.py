"""
Roadmap Generator — produces a structured React Flow-compatible roadmap
from a skill name, project description, or any learning goal.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from typing import Literal, Optional
import os

from services.db_client import supabase

api_key = os.getenv("GROQ_API_KEY")
router = APIRouter(prefix="/roadmap", tags=["Roadmap"])
model = ChatGroq(temperature=0.3, model_name="llama-3.3-70b-versatile", groq_api_key=api_key)


# ── Output schema ─────────────────────────────────────────────────────────────

class RoadmapNode(BaseModel):
    id: str = Field(..., description="Unique node ID, e.g. '1', '2', '3'")
    label: str = Field(..., description="Short title shown on the node card, max 6 words")
    node_type: Literal["start", "concept", "step", "milestone", "resource", "end"] = Field(
        ...,
        description=(
            "Node type: "
            "'start'=the starting point, "
            "'concept'=a theory or concept to understand, "
            "'step'=a hands-on action to take, "
            "'milestone'=a checkpoint/goal, "
            "'resource'=a specific resource to use, "
            "'end'=the final outcome"
        )
    )
    description: str = Field(
        ...,
        description="2-4 sentence explanation of this node — what to do, why it matters, how long it might take"
    )
    resources: list[str] = Field(
        default_factory=list,
        description=(
            "List of 1-3 concrete learning resources for this node. "
            "Format as search queries or platform suggestions, e.g. "
            "'YouTube: FastAPI full course', 'Docs: docs.docker.com', 'Course: freeCodeCamp Python' "
            "DO NOT make up URLs. Use searchable references only."
        )
    )
    estimated_time: Optional[str] = Field(
        default=None,
        description="Rough time estimate, e.g. '2-3 days', '1 week', '30 mins'"
    )


class RoadmapEdge(BaseModel):
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    label: Optional[str] = Field(default=None, description="Optional label on the edge, e.g. 'then', 'or'")


class RoadmapOutput(BaseModel):
    title: str = Field(..., description="Roadmap title, e.g. 'Learning Docker from Scratch'")
    summary: str = Field(
        ...,
        description="2-3 sentence overview of the roadmap — what the candidate will achieve and why"
    )
    nodes: list[RoadmapNode] = Field(
        ...,
        description="Ordered list of 8-15 nodes representing the learning/building path"
    )
    edges: list[RoadmapEdge] = Field(
        ...,
        description="Connections between nodes. Most should be linear, with occasional branches."
    )


structured_model = model.with_structured_output(RoadmapOutput)


# ── Request model ─────────────────────────────────────────────────────────────

class RoadmapRequest(BaseModel):
    topic: str = Field(..., description="The skill, technology, or project goal to generate a roadmap for")
    context: Literal["skill", "project", "custom"] = Field(
        default="custom",
        description="Type of roadmap: 'skill'=learning a technology, 'project'=building a project, 'custom'=freeform"
    )


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_roadmap(payload: RoadmapRequest, request: Request):
    """Generate a structured React Flow roadmap for a skill, project, or learning goal."""
    user_id = request.cookies.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    if not api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

    # Fetch candidate profile for personalization
    candidate_profile = None
    try:
        resp = supabase.rpc("get_full_candidate_profile", {"p_user_id": int(user_id)}).execute()
        candidate_profile = resp.data
    except Exception:
        pass  # Proceed without profile if unavailable

    context_instruction = {
        "skill": (
            f"The candidate wants to LEARN the skill/technology: \"{payload.topic}\". "
            "Generate a step-by-step learning roadmap starting from the basics and progressing to advanced practical usage. "
            "Include foundational concepts, hands-on practice steps, and real-world application milestones."
        ),
        "project": (
            f"The candidate wants to BUILD this project: \"{payload.topic}\". "
            "Generate a project roadmap covering: ideation, tech stack selection, setup, core development phases, "
            "testing, deployment, and final outcome. Make it actionable and sequential."
        ),
        "custom": (
            f"The candidate wants to achieve: \"{payload.topic}\". "
            "Generate a comprehensive, actionable roadmap that takes them from zero to achievement. "
            "Be practical, specific, and sequenced logically."
        ),
    }[payload.context]

    profile_section = ""
    if candidate_profile:
        profile_section = f"""
CANDIDATE PROFILE (use to personalize difficulty and skip what they already know):
{candidate_profile}
"""

    prompt = f"""
You are an expert learning coach and technical mentor.
Your job is to generate a detailed, practical, visually clear roadmap.
{profile_section}
TASK:
{context_instruction}

ROADMAP REQUIREMENTS:
1. Create 8-15 nodes total covering the full journey
2. Start with a 'start' node (the starting point / current state)
3. End with an 'end' node (the final outcome / goal achieved)
4. Use a mix of 'concept', 'step', 'milestone', and 'resource' nodes
5. Connect nodes logically — mostly linear, but branches are ok for parallel learning
6. Each node must have:
   - A short, punchy label (max 6 words)
   - A helpful 2-4 sentence description
   - 1-3 searchable learning resources (YouTube searches, official docs, courses — NO made-up URLs)
   - An estimated time
7. The roadmap should feel achievable and motivating, not overwhelming
8. Personalize difficulty based on the candidate's existing skills if profile provided

Return ONLY the structured RoadmapOutput schema. No markdown. No commentary.
"""

    try:
        result = structured_model.invoke([HumanMessage(content=prompt)])
        return JSONResponse(result.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
