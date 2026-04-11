from typing import Optional
from pydantic import BaseModel, Field, model_validator


DOMAIN_BY_ID = {
    1: "AI/ML",
    2: "Web Development",
    3: "Cybersecurity",
    4: "Data Science",
    5: "DevOps",
}


class basic_info(BaseModel):
    phone: str = Field(default="", description="The phone number of the person")
    bio: str = Field(default="", description="The bio of the person")
    resume_json: dict = Field(default_factory=dict, description="The resume in json format")
    domain: str = Field(default="AI/ML", description="The domain of the person")


class education_info(BaseModel):
    degree: str = Field(..., description="The degree obtained (e.g., B.Tech, M.Tech, Intermediate, SSC)")
    field_of_study: Optional[str] = Field(
        default=None,
        description="The field of study (e.g., Computer Science, Mechanical Engineering)"
    )
    college_name: str = Field(..., description="The name of the college or school")
    university_name: Optional[str] = Field(
        default=None,
        description="The name of the university affiliated"
    )
    gpa: Optional[float] = Field(
        default=None,
        description="The GPA or percentage obtained"
    )
    start_year: Optional[int] = Field(
        default=None,
        description="The starting year of the education"
    )
    end_year: Optional[int] = Field(
        default=None,
        description="The ending year of the education"
    )


class certificate_info(BaseModel):
    certificate_name: str = Field(..., description="The name of the certificate")
    certificate_issuer: str = Field(..., description="The issuer of the certificate")
    certificate_date: Optional[str] = Field(None, description="The date of issue of the certificate (YYYY-MM-DD if exact, otherwise null. DO NOT output partial dates like 'Aug 2024')")


class projects_info(BaseModel):
    project_name: str = Field(..., description="The name of the project")
    project_description: str = Field(..., description="The description of the project")
    project_link: Optional[str] = Field(
        default=None,
        description="The link to the project"
    )


class skills_info(BaseModel):
    skill_name: str = Field(..., description="The name of the skill")


# ── AI suggestion models (must be defined before resume_upload) ─────────────

class skill_suggestion(BaseModel):
    """Structured skill improvement suggestions returned by the LLM."""
    skills: list[str] = Field(
        ...,
        description=(
            "List of specific skill names the candidate should learn or improve to become job-ready "
            "in their domain. Return plain strings like ['Docker', 'Kubernetes', 'FastAPI']. "
            "If the candidate is already strong, return an empty list []."
        )
    )
    analysis: str = Field(
        ...,
        description=(
            "A brief, friendly explanation (2-4 sentences) of why these skills are important "
            "for the candidate's domain and where they can start learning. "
            "If skill list is empty, say 'You are good to go.'"
        )
    )


class coding_profile_ai_insights(BaseModel):
    leetcode_insight: str = Field(
        default="No LeetCode insight available.",
        description="AI insight based on LeetCode profile metrics"
    )
    codeforces_insight: str = Field(
        default="No Codeforces insight available.",
        description="AI insight based on Codeforces profile metrics"
    )
    github_insight: str = Field(
        default="No GitHub insight available.",
        description="AI insight based on GitHub profile metrics"
    )
    overall_profile_signal: str = Field(
        default="insufficient-data",
        description="Overall profile signal: weak | moderate | strong | exceptional | insufficient-data"
    )
    analysis: str = Field(
        default="Coding profile insights are not available.",
        description="A concise combined analysis across all available coding profiles"
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="A list of 3-5 specific, actionable suggestions keep them realistic and doable and stress more to make the candidate cp oriented  to improve coding profiles and demonstrate coding skills to recruiters"
    )


class suggested_project_item(BaseModel):
    """A single suggested project idea for the candidate."""
    name: str = Field(..., description="Short project name, e.g. 'Real-time Chat App with FastAPI'")
    description: str = Field(
        ...,
        description="2-3 sentence description of the project, what it does and why it matters for the candidate's profile"
    )
    tech_stack: list[str] = Field(
        ...,
        description="List of technologies/tools to use in this project, e.g. ['Python', 'FastAPI', 'Redis', 'React']"
    )


# ── Main resume model ────────────────────────────────────────────────────────

class resume_upload(BaseModel):
    candidates: basic_info = Field(..., description="The basic information of the person")
    certificates: Optional[list[certificate_info]] = Field(
        default=None,
        description="The list of certificates"
    )
    projects: Optional[list[projects_info]] = Field(
        default=None,
        description="The list of projects"
    )
    skills: Optional[list[str]] = Field(
        default_factory=list,
        description="The candidate's EXISTING technical skills extracted directly from the resume, as plain strings."
    )
    education: Optional[list[education_info]] = Field(default_factory=list, description="The list of education details")
    analysis: str = Field(
        default=(
            "We could not generate AI analysis from the extracted resume text. "
            "Please upload a text-based PDF resume or add more details and try again."
        ),
        description="Interviewer-style evaluation: how the resume looks, strengths and what needs improvement. Speak like you are giving feedback to a friend."
    )
    resume_score: int = Field(
        default=0,
        description="Score out of 100 based on structure, clarity, ATS optimization, technical depth, and presentation."
    )
    domain: str = Field(default="AI/ML", description="The domain of the resume based on the skills and experience")
    skill_analysis: skill_suggestion = Field(
        default_factory=lambda: skill_suggestion(skills=[], analysis="You are good to go."),
        description="Structured skill improvement analysis — a list of specific skills to learn and why"
    )
    suggested_projects: list[suggested_project_item] = Field(
        default_factory=list,
        description=(
            "2-4 concrete project ideas the candidate should build to strengthen their portfolio. "
            "Each project should have a name, description, and tech_stack list. "
            "If already strong, return 1 project that extends their best existing work."
        )
    )
    coding_profiles_analysis: coding_profile_ai_insights = Field(
        default_factory=coding_profile_ai_insights,
        description="AI insights based on LeetCode, Codeforces, and GitHub coding profile data"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_all_fields(cls, data):
        import logging as _log
        _logger = _log.getLogger("upload_resume.model_validator")

        if not isinstance(data, dict):
            _logger.warning("model_validator received non-dict data: type=%s", type(data).__name__)
            return data

        # Log the top-level keys the LLM returned
        _logger.info(
            "model_validator top-level keys: %s",
            list(data.keys()),
        )
        _logger.info(
            "model_validator analysis present=%s, resume_score present=%s, evaluation present=%s",
            "analysis" in data,
            "resume_score" in data,
            "evaluation" in data,
        )

        # ── Hoist fields from 'evaluation' wrapper ───────────────────────
        # The LLM sometimes nests analysis/resume_score/skill_analysis/etc.
        # inside an "evaluation" object instead of putting them at the top level.
        evaluation = data.get("evaluation")
        if isinstance(evaluation, dict):
            _logger.info(
                "model_validator found 'evaluation' wrapper with keys: %s — hoisting...",
                list(evaluation.keys()),
            )
            hoistable = (
                "analysis", "resume_score", "skill_analysis",
                "suggested_projects", "coding_profiles_analysis",
            )
            for key in hoistable:
                # Only hoist if the top-level key is missing or has a default/empty value
                if key in evaluation and (
                    key not in data
                    or data.get(key) is None
                    or data.get(key) == ""
                    or data.get(key) == 0
                    or data.get(key) == []
                ):
                    data[key] = evaluation[key]
            # Remove the wrapper so Pydantic doesn't complain about extra fields
            data.pop("evaluation", None)

        # ── Normalize domain fields ──────────────────────────────────────
        candidates = data.get("candidates")
        candidate_domain = candidates.get("domain") if isinstance(candidates, dict) else None
        top_domain = data.get("domain")
        domain_id = data.get("domain_id")

        resolved_domain = None
        if isinstance(top_domain, str) and top_domain.strip():
            resolved_domain = top_domain.strip()
        elif isinstance(candidate_domain, str) and candidate_domain.strip():
            resolved_domain = candidate_domain.strip()
        elif isinstance(domain_id, int):
            resolved_domain = DOMAIN_BY_ID.get(domain_id, "AI/ML")
        else:
            resolved_domain = "AI/ML"

        data["domain"] = resolved_domain
        if isinstance(candidates, dict):
            if not isinstance(candidates.get("domain"), str) or not candidates.get("domain", "").strip():
                candidates["domain"] = resolved_domain
        return data