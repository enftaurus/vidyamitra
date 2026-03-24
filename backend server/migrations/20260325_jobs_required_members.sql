-- Migration: Add no_of_people to jobs and enforce it for new postings
-- Run this in Supabase SQL Editor or your migration tool

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS no_of_people INTEGER;

-- Backfill old rows safely
UPDATE jobs
SET no_of_people = 1
WHERE no_of_people IS NULL;

-- Enforce not-null and valid range
ALTER TABLE jobs ALTER COLUMN no_of_people SET NOT NULL;
ALTER TABLE jobs ADD CONSTRAINT jobs_no_of_people_positive CHECK (no_of_people >= 1);
