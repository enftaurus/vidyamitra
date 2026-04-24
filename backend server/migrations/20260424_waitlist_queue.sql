-- =============================================================================
-- Migration: VidyaMitra Waitlist & Queue Management System
-- Date: 2026-04-24
-- Run this entire script in the Supabase SQL Editor.
-- It is idempotent — safe to re-run.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Status Enum
--    ACTIVE         → confirmed slot, interview rounds unlocked
--    WAITLISTED     → beyond capacity, holding in FIFO queue
--    PENDING_ACK    → promoted from waitlist, has 24 h to acknowledge
--    REJECTED       → withdrew, timed-out 3 times, or manually rejected
--    COMPLETED      → finished all interview rounds
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_status') THEN
        CREATE TYPE app_status AS ENUM (
            'ACTIVE',
            'WAITLISTED',
            'PENDING_ACK',
            'REJECTED',
            'COMPLETED'
        );
    END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- 2. application_queue
--    One row per (user, job) application.
--    applied_at  : original submission time; also used for waitlist ordering.
--                  On decay/penalty, applied_at is rewritten to push the
--                  user to the 60th-percentile tail of the queue.
--    promoted_at : timestamp when the user moved to PENDING_ACK;
--                  used to enforce the 24-hour acknowledgment window.
--    penalty_count: number of times the user missed the ack window;
--                  at 3 the entry moves to REJECTED automatically.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_queue (
    id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    job_id        BIGINT      NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id       BIGINT      NOT NULL,
    status        app_status  NOT NULL DEFAULT 'WAITLISTED',
    applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    promoted_at   TIMESTAMPTZ,          -- set when → PENDING_ACK
    penalty_count INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A user can only have one live entry per job
    CONSTRAINT uq_aq_user_job UNIQUE (user_id, job_id)
);

-- Indexes for the hot query paths
CREATE INDEX IF NOT EXISTS idx_aq_job_status
    ON application_queue (job_id, status);

CREATE INDEX IF NOT EXISTS idx_aq_job_applied
    ON application_queue (job_id, applied_at ASC)
    WHERE status = 'WAITLISTED';

CREATE INDEX IF NOT EXISTS idx_aq_promoted_at
    ON application_queue (promoted_at)
    WHERE status = 'PENDING_ACK';


-- ---------------------------------------------------------------------------
-- 3. application_audit_log
--    Immutable append-only log. Every status transition yields one row.
--    reason: free-text explaining what triggered the transition
--            (e.g. "user_applied", "slot_opened", "ack_timeout_penalty_1",
--             "ack_timeout_rejected", "user_withdrew", "user_acknowledged").
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_audit_log (
    id          BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    queue_id    BIGINT      NOT NULL REFERENCES application_queue(id) ON DELETE CASCADE,
    job_id      BIGINT      NOT NULL,
    user_id     BIGINT      NOT NULL,
    old_status  TEXT,                   -- NULL for the initial INSERT event
    new_status  TEXT        NOT NULL,
    reason      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aal_queue_id
    ON application_audit_log (queue_id);

CREATE INDEX IF NOT EXISTS idx_aal_job_id
    ON application_audit_log (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aal_user_id
    ON application_audit_log (user_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- 4. users table — promotion notification flag
--    has_unread_promotion is set to TRUE when the user is promoted to
--    PENDING_ACK.  The frontend polls /jobs/{id}/my-status and clears it
--    once the user acknowledges (or the backend clears it on acknowledge).
-- ---------------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS has_unread_promotion BOOLEAN NOT NULL DEFAULT FALSE;


-- ---------------------------------------------------------------------------
-- 5. updated_at auto-maintenance trigger for application_queue
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aq_updated_at ON application_queue;
CREATE TRIGGER trg_aq_updated_at
    BEFORE UPDATE ON application_queue
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
