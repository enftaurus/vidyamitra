import json
from typing import Optional

from services.db_client import supabase
from services.redis import redis_client

ROUND_KEYS = ["coding", "technical", "manager", "hr"]


def _active_job_key(user_id: str) -> str:
    return f"user:{user_id}:active_job_id"


def _round_scores_key(user_id: str, job_id: int) -> str:
    return f"user:{user_id}:job:{job_id}:round_scores"


def set_active_job_id(user_id: str, job_id: int) -> None:
    redis_client.set(_active_job_key(user_id), str(job_id), ex=86400)
    reset_round_scores(user_id, job_id)


def get_active_job_id(user_id: str) -> Optional[int]:
    raw = redis_client.get(_active_job_key(user_id))
    if not raw:
        return None
    try:
        return int(raw)
    except Exception:
        return None


def reset_round_scores(user_id: str, job_id: int) -> None:
    redis_client.set(
        _round_scores_key(user_id, job_id),
        json.dumps({key: 0 for key in ROUND_KEYS}),
        ex=86400,
    )


def _read_round_scores(user_id: str, job_id: int) -> dict:
    raw = redis_client.get(_round_scores_key(user_id, job_id))
    if not raw:
        return {key: 0 for key in ROUND_KEYS}

    try:
        parsed = json.loads(raw)
        result = {key: 0 for key in ROUND_KEYS}
        for key in ROUND_KEYS:
            value = parsed.get(key, 0)
            result[key] = max(0, int(value))
        return result
    except Exception:
        return {key: 0 for key in ROUND_KEYS}


def _write_round_scores(user_id: str, job_id: int, scores: dict) -> None:
    safe = {key: max(0, int(scores.get(key, 0))) for key in ROUND_KEYS}
    redis_client.set(_round_scores_key(user_id, job_id), json.dumps(safe), ex=86400)


def _ensure_leaderboard_row(job_id: int, user_id: int) -> None:
    existing = (
        supabase
        .table("leaderboard")
        .select("id")
        .eq("job_id", job_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if existing.data:
        return

    supabase.table("leaderboard").insert(
        {
            "job_id": job_id,
            "user_id": user_id,
            "score": 0,
        }
    ).execute()


def register_quick_apply(user_id: int, job_id: int) -> None:
    _ensure_leaderboard_row(job_id, user_id)
    set_active_job_id(str(user_id), job_id)


def record_round_score(user_id: int, round_name: str, round_score: int) -> Optional[int]:
    if round_name not in ROUND_KEYS:
        return None

    active_job_id = get_active_job_id(str(user_id))
    if not active_job_id:
        return None

    _ensure_leaderboard_row(active_job_id, user_id)

    scores = _read_round_scores(str(user_id), active_job_id)
    scores[round_name] = max(0, int(round_score))
    _write_round_scores(str(user_id), active_job_id, scores)

    total_score = sum(scores.values())

    supabase.table("leaderboard").update(
        {
            "score": total_score,
        }
    ).eq("job_id", active_job_id).eq("user_id", user_id).execute()

    return total_score
