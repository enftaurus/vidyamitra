from pydantic import BaseModel, Field
from typing import List
class DomainSwitchRequest(BaseModel):
    target_domain: str


class SkillToDevelop(BaseModel):
    skill: str = Field(..., description="Name of the skill that will help the user grow in the target domain")

    importance: str = Field(
        ...,
        description="Priority level for this skill in the transition: high, medium, or low"
    )

    why_this_matters: str = Field(
        ...,
        description="Explanation of how this skill contributes to success in the target domain"
    )

    suggested_resources: List[str] = Field(
        ...,
        description="Courses, platforms, or learning resources the user can use to build this skill"
    )


class RoadmapStep(BaseModel):
    step: int = Field(..., description="Step number in the recommended learning journey")

    title: str = Field(..., description="Short title of this phase in the transition roadmap")

    description: str = Field(
        ...,
        description="What the user should focus on in this step and what they are expected to achieve"
    )

    estimated_time: str = Field(
        ...,
        description="Approximate time required to complete this step (e.g., '3 weeks', '2 months')"
    )


class JobRole(BaseModel):
    role: str = Field(..., description="Relevant job role in the target domain")

    demand_level: str = Field(
        ...,
        description="Current hiring demand for this role in the market: high, medium, or low"
    )

    average_salary: str = Field(
        ...,
        description="Typical salary range for this role based on current market trends"
    )

    description: str = Field(
        ...,
        description="Brief explanation of what this role involves and why it matches the user's profile"
    )


class DomainSwitchAnalysis(BaseModel):
    target_domain: str = Field(
        ...,
        description="The new domain the user wants to transition into"
    )

    is_switch_recommended: bool = Field(
        ...,
        description="Whether switching to this domain is a good decision for the user based on their background"
    )

    recommendation_summary: str = Field(
        ...,
        description="A personalized explanation of why this domain switch is or is not recommended"
    )

    current_strengths: List[str] = Field(
        ...,
        description="Skills, experiences, or knowledge the user already has that are valuable in the target domain"
    )

    transferable_skills: List[str] = Field(
        ...,
        description="Existing skills that can be applied effectively in the new domain even if they come from a different field"
    )

    skills_to_develop: List[SkillToDevelop] = Field(
        ...,
        description="Key skills the user should focus on learning next to become job-ready in the target domain"
    )

    learning_roadmap: List[RoadmapStep] = Field(
        ...,
        description="A step-by-step structured plan to successfully transition into the target domain"
    )

    job_opportunities: List[JobRole] = Field(
        ...,
        description="Relevant job roles the user can target after completing the transition plan"
    )

    market_outlook: str = Field(
        ...,
        description="Future growth, stability, and industry demand for the chosen domain"
    )

    transition_difficulty: str = Field(
        ...,
        description="How challenging this domain switch will be for the user: easy, moderate, or challenging"
    )

    estimated_transition_time: str = Field(
        ...,
        description="Realistic time required for the user to become job-ready in the new domain"
    )

    long_term_growth_potential: str = Field(
        ...,
        description="Career growth opportunities in this domain over the next 5–10 years"
    )

    final_guidance: str = Field(
        ...,
        description="Motivational and practical final advice tailored specifically to the user's profile and goals"
    )