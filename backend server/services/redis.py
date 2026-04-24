"""
services/redis.py
─────────────────
Centralised Redis client for VidyaMitra.

Provides:
  • redis_client  — raw connection used by existing code (leaderboard, round
                    scores, job-context caching, etc.)
  • acquire_lock  — non-blocking SETNX distributed lock (returns True/False)
  • release_lock  — safe delete only if this caller still owns the lock
  • wait_for_lock — blocking acquire with configurable retry (used by the
                    promotion cascade so concurrent requests don't all fail)
"""

import time
import uuid

import redis

# ---------------------------------------------------------------------------
# Shared connection
# ---------------------------------------------------------------------------
redis_client = redis.Redis(host="localhost", port=6379, decode_responses=True)


# ---------------------------------------------------------------------------
# Distributed lock primitives
# ---------------------------------------------------------------------------

def acquire_lock(key: str, ttl_ms: int = 5000) -> str | None:
    """
    Try to acquire a distributed lock.

    Uses Redis SET NX PX (atomic set-if-not-exists with millisecond expiry).
    Returns a unique *token* string that the caller MUST pass to release_lock.
    Returns None if the lock is already held by someone else.

    Args:
        key:    Lock key, e.g. "lock:promotion:42"
        ttl_ms: Milliseconds until the lock auto-expires (safety net for
                crashed processes).  Default 5 000 ms.

    Returns:
        A unique token string on success, None on failure.
    """
    token = str(uuid.uuid4())
    acquired = redis_client.set(key, token, nx=True, px=ttl_ms)
    return token if acquired else None


def release_lock(key: str, token: str) -> bool:
    """
    Release the lock ONLY if we still own it (compare-and-delete via Lua).

    This prevents a slow process from deleting a lock that has already
    expired and been re-acquired by another process.

    Args:
        key:   Same lock key passed to acquire_lock.
        token: The token returned by acquire_lock.

    Returns:
        True if the lock was released, False if it had already expired or
        was owned by a different caller.
    """
    lua_script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
    """
    result = redis_client.eval(lua_script, 1, key, token)
    return bool(result)


def wait_for_lock(
    key: str,
    ttl_ms: int = 5000,
    timeout_s: float = 2.0,
    poll_interval_s: float = 0.05,
) -> str | None:
    """
    Blocking acquire: retries until timeout_s elapses or the lock is free.

    Used when two quick-apply requests race for the last slot.  The second
    request spins here (≤2 s) rather than failing immediately, then
    re-checks capacity and lands in WAITLISTED if the slot was taken.

    Args:
        key:            Lock key.
        ttl_ms:         Lock TTL in milliseconds.
        timeout_s:      Maximum seconds to wait before giving up.
        poll_interval_s: Seconds between retry attempts.

    Returns:
        A token string on success, None on timeout.
    """
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        token = acquire_lock(key, ttl_ms)
        if token:
            return token
        time.sleep(poll_interval_s)
    return None