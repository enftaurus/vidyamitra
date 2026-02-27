from fastapi import HTTPException
from services.redis import redis_client
import json

ROUND_ORDER = ["coding", "technical", "manager", "hr"]


def _key(user_id: str) -> str:
    return f"user:{user_id}:round_flow"


def _default_state() -> dict:
    return {
        "coding": "not_started",
        "technical": "not_started",
        "manager": "not_started",
        "hr": "not_started",
    }


def get_flow_state(user_id: str) -> dict:
    try:
        raw = redis_client.get(_key(user_id))
        if not raw:
            return _default_state()
        parsed = json.loads(raw)
        state = _default_state()
        state.update({k: v for k, v in parsed.items() if k in state})
        return state
    except Exception:
        return _default_state()


def save_flow_state(user_id: str, state: dict) -> None:
    redis_client.set(_key(user_id), json.dumps(state), ex=86400)


def set_round_state(user_id: str, round_name: str, value: str) -> dict:
    state = get_flow_state(user_id)
    state[round_name] = value
    save_flow_state(user_id, state)
    return state


def reset_flow_state(user_id: str) -> dict:
    state = _default_state()
    save_flow_state(user_id, state)
    return state


def ensure_round_start_allowed(user_id: str, round_name: str) -> dict:
    if round_name not in ROUND_ORDER:
        raise HTTPException(status_code=400, detail="Invalid round")

    state = get_flow_state(user_id)
    idx = ROUND_ORDER.index(round_name)

    for required in ROUND_ORDER[:idx]:
        if state.get(required) != "completed":
            raise HTTPException(
                status_code=403,
                detail=f"Complete {required} round first.",
            )

    if state.get(round_name) == "completed":
        raise HTTPException(
            status_code=400,
            detail=f"{round_name.capitalize()} round already completed.",
        )

    return state


def ensure_round_answer_allowed(user_id: str, round_name: str) -> dict:
    state = get_flow_state(user_id)
    status = state.get(round_name)
    if status not in ("in_progress", "completed"):
        raise HTTPException(
            status_code=403,
            detail=f"Start {round_name} round first.",
        )
    return state
