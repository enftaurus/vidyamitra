from typing import Any, Literal, Optional, TypedDict
from pydantic import BaseModel, Field


class QA(TypedDict):
    question: str
    answer: str


class final_analysis(BaseModel):
    analysis: str
    tips: str
    strengths: list[str]
    weaknesses: list[str]
    areas_to_focus_on: list[str]
    score: int


class HRInterviewState(TypedDict):
    candidate_profile: Any
    questiions_and_answers: list[QA]
    next_question: str
    should_end: bool
    action: Literal["increase_difficulty", "decrease_difficulty", "keep_difficulty", "end_interview"]
    analysis: Optional[final_analysis]
    current_answer: str


class hr_model_result(BaseModel):
    next_question: Optional[str] = Field(
        None,
        description="The next question for HR round based on candidate response and profile",
    )
    should_end: bool = Field(..., description="Whether the HR interview should end")
    action: Literal[
        "increase_difficulty", "decrease_difficulty", "keep_difficulty", "end_interview"
    ] = Field(..., description="Difficulty decision for the next HR-round question")


class hr_answer_request(BaseModel):
    answer: str = Field(..., description="Candidate answer for the current HR-round question")
