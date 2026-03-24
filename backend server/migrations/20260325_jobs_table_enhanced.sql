-- Migration: Create or Update Jobs Table with Enhanced Fields
-- Run this in Supabase SQL Editor or your migration tool

-- Option 1: If jobs table doesn't exist, create it
CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  description TEXT,
  job_role VARCHAR(255),
  apply_url VARCHAR(500),
  is_external BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_id ON jobs(id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_is_external ON jobs(is_external);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- Option 2: If jobs table already exists, add missing columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_role VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Make apply_url nullable for external jobs
ALTER TABLE jobs ALTER COLUMN apply_url DROP NOT NULL;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_jobs_is_external ON jobs(is_external);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
