-- Migration: Leaderboard table and uniqueness for per-job leaderboard entries
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id bigint NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure one leaderboard row per (job_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS ux_leaderboard_job_user ON leaderboard(job_id, user_id);

-- Useful lookup/ranking indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_job_score ON leaderboard(job_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user ON leaderboard(user_id);
