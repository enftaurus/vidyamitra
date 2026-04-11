"""
Job context helpers for interview rounds.

Stores the full job dict in Redis when a user clicks Quick Apply, so that
all interview round prompts can reference the target job's title, company,
description, required skills, etc.
"""

import json
from typing import Optional

from services.redis import redis_client

_TTL = 86400  # 24 hours


def _key(user_id: str) -> str:
    return f"user:{user_id}:active_job"


def set_active_job(user_id: str, job: dict) -> None:
    """Persist the full job dict the user applied to."""
    redis_client.set(_key(user_id), json.dumps(job, default=str), ex=_TTL)


def get_active_job(user_id: str) -> Optional[dict]:
    """Return the active job dict, or None if no job is set."""
    raw = redis_client.get(_key(user_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def clear_active_job(user_id: str) -> None:
    """Remove the active job context (e.g. on interview reset)."""
    try:
        redis_client.delete(_key(user_id))
    except Exception:
        pass


def format_job_context_for_prompt(job: Optional[dict]) -> str:
    """
    Convert the job dict into a block of text suitable for injection into
    LLM prompts.  Returns an empty string when no job is available.
    """
    if not job:
        return ""

    parts = ["JOB CONTEXT (the candidate is interviewing for this specific role):"]
    if job.get("title"):
        parts.append(f"  Role / Title: {job['title']}")
    if job.get("company"):
        parts.append(f"  Company: {job['company']}")
    if job.get("location"):
        parts.append(f"  Location: {job['location']}")
    if job.get("description"):
        parts.append(f"  Job Description:\n    {job['description']}")

    if len(parts) <= 1:
        return ""

    parts.append(
        "IMPORTANT: Tailor ALL questions and evaluation to this specific role. "
        "Questions should test skills, knowledge, and aptitude directly relevant "
        "to this job posting."
    )
    return "\n".join(parts)
