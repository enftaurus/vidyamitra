"""
services/queue_service.py
─────────────────────────
Core engine for the VidyaMitra Waitlist & Queue Management System.

Responsibilities
────────────────
1. _log_transition      — append one immutable row to application_audit_log.
2. _run_lazy_decay      — find stale PENDING_ACK entries for a job and apply
                          the 60th-percentile penalty (or REJECTED at 3 misses).
3. _promote_next        — move the earliest WAITLISTED applicant → PENDING_ACK
                          and set the notification flag on their user row.
4. cascade_promotion    — top-level orchestrator:
                            acquire Redis lock → lazy decay → count open slots
                            → promote → release lock.
                          Called as a FastAPI BackgroundTask so the API stays fast.
5. get_queue_position   — return a user's current status + waitlist rank.

Concurrency Model
─────────────────
Redis SETNX lock  ``lock:promotion:{job_id}``  (5 s TTL).
  • Only one goroutine/thread runs the promotion logic at a time per job.
  • A second simultaneous quick-apply will wait_for_lock up to 2 s then
    re-read the DB — if the slot was taken it will already see it full and
    land in WAITLISTED.

Decay Window & Penalty
──────────────────────
Window : 24 hours from ``promoted_at``.
Penalty: applied_at is rewritten to ``now() - offset`` so the user sorts
         to floor(waitlist_length * 0.6)  (60th-percentile tail).
         penalty_count increments each time.
         At penalty_count >= 3 the entry is set to REJECTED.
         Every decay triggers one cascade_promotion call so the freed slot
         is filled without manual intervention.
"""

import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from supabase import Client

from services.redis import wait_for_lock, release_lock

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ACK_WINDOW_HOURS: int = 24
"""Hours a PENDING_ACK user has to confirm their spot."""

MAX_PENALTIES: int = 3
"""Number of missed acknowledgment windows before permanent REJECTED."""

DECAY_PERCENTILE: float = 0.6
"""Position in queue (as fraction) where a penalised user is reinserted."""

LOCK_TTL_MS: int = 5_000
"""Redis lock TTL in milliseconds — safety net for crashed processes."""

LOCK_WAIT_S: float = 2.0
"""How long a competing request will spin waiting for the lock."""


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _now_utc() -> datetime:
    """Return tz-aware current UTC time."""
    return datetime.now(timezone.utc)


def _log_transition(
    db: Client,
    *,
    queue_id: int,
    job_id: int,
    user_id: int,
    old_status: Optional[str],
    new_status: str,
    reason: str,
) -> None:
    """
    Append one row to application_audit_log.

    This is the single source-of-truth for every state transition.
    All pipeline movements are traceable and reconstructable from this table.

    Args:
        db         : Supabase client.
        queue_id   : application_queue.id for this entry.
        job_id     : Denormalised for efficient per-job audit queries.
        user_id    : Denormalised for efficient per-user audit queries.
        old_status : Previous status string, or None for the initial insert.
        new_status : Status the entry is moving to.
        reason     : Human-readable trigger label.
    """
    try:
        db.table("application_audit_log").insert(
            {
                "queue_id": queue_id,
                "job_id": job_id,
                "user_id": user_id,
                "old_status": old_status,
                "new_status": new_status,
                "reason": reason,
            }
        ).execute()
    except Exception as exc:
        # Audit failures must never crash the main flow.
        logger.error(
            "audit_log insert failed queue_id=%s reason=%s error=%s",
            queue_id, reason, exc,
        )


def _run_lazy_decay(job_id: int, db: Client) -> int:
    """
    Find all PENDING_ACK entries for this job whose 24-hour window has expired
    and apply the appropriate penalty.

    This is the "Lazy Evaluation" strategy: instead of a background cron,
    the check runs on every user touchpoint (quick-apply, my-status,
    acknowledge) so the queue self-heals on demand with zero extra workers.

    Penalty logic
    ─────────────
    • penalty_count < MAX_PENALTIES (3):
        – Increment penalty_count.
        – Rewrite applied_at so the user slots into the 60th-percentile tail
          of the waitlist.  We achieve this by looking up how many WAITLISTED
          entries exist, computing the target rank, then finding the
          applied_at of the entry at that position and adding 1 µs so we
          sort just after it.
        – Set status = 'WAITLISTED', clear promoted_at.

    • penalty_count >= MAX_PENALTIES:
        – Set status = 'REJECTED'.

    Every transition is written to application_audit_log.

    Returns:
        Number of entries that were decayed.
    """
    cutoff = _now_utc() - timedelta(hours=ACK_WINDOW_HOURS)
    cutoff_iso = cutoff.isoformat()

    # Fetch stale PENDING_ACK entries for this job
    stale_resp = (
        db.table("application_queue")
        .select("id, user_id, penalty_count, promoted_at")
        .eq("job_id", job_id)
        .eq("status", "PENDING_ACK")
        .lt("promoted_at", cutoff_iso)
        .execute()
    )
    stale_entries = stale_resp.data or []

    if not stale_entries:
        return 0

    decayed_count = 0

    # Count current waitlisted users once (used for position calculation)
    wl_count_resp = (
        db.table("application_queue")
        .select("id", count="exact")
        .eq("job_id", job_id)
        .eq("status", "WAITLISTED")
        .execute()
    )
    waitlist_length = wl_count_resp.count or 0

    for entry in stale_entries:
        q_id = entry["id"]
        u_id = entry["user_id"]
        penalty = entry.get("penalty_count", 0)
        new_penalty = penalty + 1

        if new_penalty >= MAX_PENALTIES:
            # ── Hard reject ────────────────────────────────────────────────
            db.table("application_queue").update(
                {
                    "status": "REJECTED",
                    "penalty_count": new_penalty,
                    "promoted_at": None,
                }
            ).eq("id", q_id).execute()

            _log_transition(
                db,
                queue_id=q_id,
                job_id=job_id,
                user_id=u_id,
                old_status="PENDING_ACK",
                new_status="REJECTED",
                reason=f"ack_timeout_rejected_penalty_{new_penalty}",
            )
        else:
            # ── Penalise and reinsert at 60th-percentile tail ──────────────
            target_rank = math.floor(waitlist_length * DECAY_PERCENTILE)

            # Find the applied_at of the entry currently at that position
            # (ordered ASC so lower index = higher priority)
            anchor_resp = (
                db.table("application_queue")
                .select("applied_at")
                .eq("job_id", job_id)
                .eq("status", "WAITLISTED")
                .order("applied_at", desc=False)
                .limit(1)
                .offset(target_rank)
                .execute()
            )
            anchor_rows = anchor_resp.data or []

            if anchor_rows:
                # Place just after the anchor so we sort to the tail
                anchor_dt = datetime.fromisoformat(
                    anchor_rows[0]["applied_at"].replace("Z", "+00:00")
                )
                new_applied_at = (anchor_dt + timedelta(microseconds=1)).isoformat()
            else:
                # Waitlist is empty or shorter than target_rank — use now()
                new_applied_at = _now_utc().isoformat()

            db.table("application_queue").update(
                {
                    "status": "WAITLISTED",
                    "penalty_count": new_penalty,
                    "promoted_at": None,
                    "applied_at": new_applied_at,
                }
            ).eq("id", q_id).execute()

            _log_transition(
                db,
                queue_id=q_id,
                job_id=job_id,
                user_id=u_id,
                old_status="PENDING_ACK",
                new_status="WAITLISTED",
                reason=f"ack_timeout_penalty_{new_penalty}_requeued_at_{DECAY_PERCENTILE:.0%}",
            )

            waitlist_length += 1  # account for this re-entry in subsequent calculations

        decayed_count += 1

    logger.info("lazy_decay job_id=%s decayed=%s", job_id, decayed_count)
    return decayed_count


def _promote_next(job_id: int, db: Client) -> bool:
    """
    Promote the earliest WAITLISTED applicant to PENDING_ACK (FIFO).

    Sets:
      • status         → PENDING_ACK
      • promoted_at    → now()        (starts the 24-hour ack clock)
      • has_unread_promotion → True   (drives the red pulse badge in the UI)

    Returns:
        True if someone was promoted, False if the waitlist was empty.
    """
    # Grab the next in line (lowest applied_at = longest waiting)
    next_resp = (
        db.table("application_queue")
        .select("id, user_id")
        .eq("job_id", job_id)
        .eq("status", "WAITLISTED")
        .order("applied_at", desc=False)
        .limit(1)
        .execute()
    )
    candidates = next_resp.data or []

    if not candidates:
        return False

    candidate = candidates[0]
    q_id = candidate["id"]
    u_id = candidate["user_id"]
    promoted_at = _now_utc().isoformat()

    # Update queue entry
    db.table("application_queue").update(
        {
            "status": "PENDING_ACK",
            "promoted_at": promoted_at,
        }
    ).eq("id", q_id).execute()

    # Notify the user (drives the red pulse badge in Layout.jsx)
    try:
        db.table("users").update(
            {"has_unread_promotion": True}
        ).eq("id", u_id).execute()
    except Exception as exc:
        logger.warning("Failed to set has_unread_promotion user_id=%s: %s", u_id, exc)

    _log_transition(
        db,
        queue_id=q_id,
        job_id=job_id,
        user_id=u_id,
        old_status="WAITLISTED",
        new_status="PENDING_ACK",
        reason="slot_opened_promoted",
    )

    logger.info("promoted user_id=%s to PENDING_ACK for job_id=%s", u_id, job_id)
    return True


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def cascade_promotion(job_id: int, db: Client) -> None:
    """
    Top-level orchestrator — intended to run as a FastAPI BackgroundTask.

    Flow
    ────
    1. Acquire Redis distributed lock  (prevents concurrent double-promotions)
    2. Run lazy decay for the job      (expire stale PENDING_ACK entries)
    3. Count currently open slots      (capacity - ACTIVE - PENDING_ACK)
    4. For each open slot, promote the next WAITLISTED applicant
    5. Release the lock

    The cascade continues until either slots are full or the waitlist is empty.
    Multiple rounds of decay can open multiple slots, all filled in one pass.

    Args:
        job_id : The job to process.
        db     : Supabase client instance.
    """
    lock_key = f"lock:promotion:{job_id}"
    token = wait_for_lock(lock_key, ttl_ms=LOCK_TTL_MS, timeout_s=LOCK_WAIT_S)

    if not token:
        logger.warning(
            "cascade_promotion could not acquire lock for job_id=%s — skipping",
            job_id,
        )
        return

    try:
        # Step 1: decay stale PENDING_ACK entries
        _run_lazy_decay(job_id, db)

        # Step 2: fetch job capacity
        job_resp = (
            db.table("jobs")
            .select("no_of_people")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        if not job_resp.data:
            logger.error("cascade_promotion: job_id=%s not found", job_id)
            return

        capacity: int = job_resp.data[0].get("no_of_people") or 1

        # Step 3: count occupied slots (ACTIVE + PENDING_ACK count against capacity)
        occupied_resp = (
            db.table("application_queue")
            .select("id", count="exact")
            .eq("job_id", job_id)
            .in_("status", ["ACTIVE", "PENDING_ACK"])
            .execute()
        )
        occupied: int = occupied_resp.count or 0
        open_slots: int = max(0, capacity - occupied)

        # Step 4: fill each open slot
        for _ in range(open_slots):
            promoted = _promote_next(job_id, db)
            if not promoted:
                break  # waitlist exhausted

    except Exception as exc:
        logger.error("cascade_promotion error job_id=%s: %s", job_id, exc)
    finally:
        release_lock(lock_key, token)


def apply_to_job(
    job_id: int,
    user_id: int,
    db: Client,
) -> dict:
    """
    Attempt to register a user's application.

    Called inside ``POST /jobs/quick-apply`` *before* the background task.
    Uses the same Redis lock as cascade_promotion so a simultaneous apply
    from another user cannot race for the last slot.

    Returns a dict:
        {
            "status":         "ACTIVE" | "WAITLISTED",
            "queue_id":       int,
            "queue_position": int | None,   # None when ACTIVE
            "waitlist_total": int | None,
        }

    Raises:
        ValueError: if the user already has a non-REJECTED entry for this job.
        RuntimeError: if the Redis lock cannot be acquired.
    """
    lock_key = f"lock:promotion:{job_id}"
    token = wait_for_lock(lock_key, ttl_ms=LOCK_TTL_MS, timeout_s=LOCK_WAIT_S)
    if not token:
        raise RuntimeError(
            "The queue is momentarily busy — please retry in a few seconds."
        )

    try:
        # ── Run lazy decay first so capacity count is accurate ──────────────
        _run_lazy_decay(job_id, db)

        # ── Check for an existing live entry ───────────────────────────────
        existing_resp = (
            db.table("application_queue")
            .select("id, status")
            .eq("job_id", job_id)
            .eq("user_id", user_id)
            .neq("status", "REJECTED")   # allow re-apply after rejection
            .limit(1)
            .execute()
        )
        if existing_resp.data:
            ex = existing_resp.data[0]
            raise ValueError(
                f"You already have an active application (status: {ex['status']})."
            )

        # ── Determine slot availability ─────────────────────────────────────
        job_resp = (
            db.table("jobs")
            .select("no_of_people")
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        capacity: int = (job_resp.data[0].get("no_of_people") or 1) if job_resp.data else 1

        occupied_resp = (
            db.table("application_queue")
            .select("id", count="exact")
            .eq("job_id", job_id)
            .in_("status", ["ACTIVE", "PENDING_ACK"])
            .execute()
        )
        occupied: int = occupied_resp.count or 0
        slot_available: bool = occupied < capacity

        new_status = "ACTIVE" if slot_available else "WAITLISTED"
        now_iso = _now_utc().isoformat()

        # ── Insert queue entry ─────────────────────────────────────────────
        insert_resp = (
            db.table("application_queue")
            .insert(
                {
                    "job_id": job_id,
                    "user_id": user_id,
                    "status": new_status,
                    "applied_at": now_iso,
                }
            )
            .execute()
        )
        new_entry = insert_resp.data[0]
        q_id = new_entry["id"]

        _log_transition(
            db,
            queue_id=q_id,
            job_id=job_id,
            user_id=user_id,
            old_status=None,
            new_status=new_status,
            reason="user_applied",
        )

        # ── Build return payload ───────────────────────────────────────────
        result: dict = {
            "status": new_status,
            "queue_id": q_id,
            "queue_position": None,
            "waitlist_total": None,
        }

        if new_status == "WAITLISTED":
            position, total = _waitlist_rank(job_id, q_id, db)
            result["queue_position"] = position
            result["waitlist_total"] = total

        return result

    finally:
        release_lock(lock_key, token)


def acknowledge_spot(job_id: int, user_id: int, db: Client) -> dict:
    """
    Confirm a PENDING_ACK slot → ACTIVE.

    Also clears the ``has_unread_promotion`` flag on the user row.

    Returns:
        {"success": True, "queue_id": int}

    Raises:
        ValueError: if no PENDING_ACK entry is found for this user/job.
    """
    # Lazy decay first — keeps the queue clean
    _run_lazy_decay(job_id, db)

    entry_resp = (
        db.table("application_queue")
        .select("id, status")
        .eq("job_id", job_id)
        .eq("user_id", user_id)
        .eq("status", "PENDING_ACK")
        .limit(1)
        .execute()
    )
    if not entry_resp.data:
        raise ValueError(
            "No pending acknowledgment found for this job. "
            "Your window may have expired — check your current status."
        )

    q_id = entry_resp.data[0]["id"]

    db.table("application_queue").update(
        {"status": "ACTIVE", "promoted_at": None}
    ).eq("id", q_id).execute()

    # Clear notification flag
    try:
        db.table("users").update(
            {"has_unread_promotion": False}
        ).eq("id", user_id).execute()
    except Exception as exc:
        logger.warning("Failed to clear has_unread_promotion user_id=%s: %s", user_id, exc)

    _log_transition(
        db,
        queue_id=q_id,
        job_id=job_id,
        user_id=user_id,
        old_status="PENDING_ACK",
        new_status="ACTIVE",
        reason="user_acknowledged",
    )

    return {"success": True, "queue_id": q_id}


def withdraw_application(job_id: int, user_id: int, db: Client) -> dict:
    """
    Withdraw an active/waitlisted/pending-ack application.

    Sets status → REJECTED and triggers a cascade so the freed slot
    (if ACTIVE or PENDING_ACK) is immediately reassigned.

    Returns:
        {"success": True, "freed_slot": bool}

    Raises:
        ValueError: if no live entry is found.
    """
    entry_resp = (
        db.table("application_queue")
        .select("id, status")
        .eq("job_id", job_id)
        .eq("user_id", user_id)
        .in_("status", ["ACTIVE", "WAITLISTED", "PENDING_ACK"])
        .limit(1)
        .execute()
    )
    if not entry_resp.data:
        raise ValueError("No active application found to withdraw.")

    entry = entry_resp.data[0]
    q_id = entry["id"]
    old_status = entry["status"]
    freed_slot = old_status in ("ACTIVE", "PENDING_ACK")

    db.table("application_queue").update(
        {"status": "REJECTED"}
    ).eq("id", q_id).execute()

    _log_transition(
        db,
        queue_id=q_id,
        job_id=job_id,
        user_id=user_id,
        old_status=old_status,
        new_status="REJECTED",
        reason="user_withdrew",
    )

    return {"success": True, "freed_slot": freed_slot}


def get_queue_position(job_id: int, user_id: int, db: Client) -> dict:
    """
    Return a user's current queue state after running lazy decay.

    This is called by ``GET /jobs/{job_id}/my-status`` and powers the
    frontend status badge.

    Runs lazy decay first so the returned data is always fresh even without
    a cron job.

    Returns:
        {
            "found":          bool,
            "status":         str | None,
            "queue_position": int | None,   # 1-indexed; None if not WAITLISTED
            "waitlist_total": int | None,
            "ack_deadline":   str | None,   # ISO timestamp; only for PENDING_ACK
            "penalty_count":  int,
        }
    """
    # Lazy decay ensures stale PENDING_ACK entries are cleaned before we read
    _run_lazy_decay(job_id, db)

    entry_resp = (
        db.table("application_queue")
        .select("id, status, promoted_at, penalty_count")
        .eq("job_id", job_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not entry_resp.data:
        return {
            "found": False,
            "status": None,
            "queue_position": None,
            "waitlist_total": None,
            "ack_deadline": None,
            "penalty_count": 0,
        }

    entry = entry_resp.data[0]
    status = entry["status"]
    q_id = entry["id"]

    ack_deadline: str | None = None
    if status == "PENDING_ACK" and entry.get("promoted_at"):
        promoted_dt = datetime.fromisoformat(
            entry["promoted_at"].replace("Z", "+00:00")
        )
        ack_deadline = (promoted_dt + timedelta(hours=ACK_WINDOW_HOURS)).isoformat()

    queue_position: int | None = None
    waitlist_total: int | None = None
    if status == "WAITLISTED":
        queue_position, waitlist_total = _waitlist_rank(job_id, q_id, db)

    return {
        "found": True,
        "status": status,
        "queue_position": queue_position,
        "waitlist_total": waitlist_total,
        "ack_deadline": ack_deadline,
        "penalty_count": entry.get("penalty_count", 0),
    }


# ---------------------------------------------------------------------------
# Private utility
# ---------------------------------------------------------------------------

def _waitlist_rank(job_id: int, queue_id: int, db: Client) -> tuple[int, int]:
    """
    Compute the 1-indexed waitlist position and total count for a given entry.

    Position is determined by how many WAITLISTED entries for this job have
    an applied_at strictly earlier than this entry's applied_at.

    Returns:
        (position, total)  — e.g. (5, 12) means "5th out of 12 in waitlist"
    """
    # Get the entry's own applied_at
    own_resp = (
        db.table("application_queue")
        .select("applied_at")
        .eq("id", queue_id)
        .limit(1)
        .execute()
    )
    if not own_resp.data:
        return (1, 1)

    own_applied_at = own_resp.data[0]["applied_at"]

    # Count entries ahead (earlier applied_at)
    ahead_resp = (
        db.table("application_queue")
        .select("id", count="exact")
        .eq("job_id", job_id)
        .eq("status", "WAITLISTED")
        .lt("applied_at", own_applied_at)
        .execute()
    )
    ahead: int = ahead_resp.count or 0

    # Total waitlisted
    total_resp = (
        db.table("application_queue")
        .select("id", count="exact")
        .eq("job_id", job_id)
        .eq("status", "WAITLISTED")
        .execute()
    )
    total: int = total_resp.count or 1

    return (ahead + 1, total)
