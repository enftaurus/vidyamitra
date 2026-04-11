-- Stores coding profile snapshots and AI insights captured during resume upload/build.
-- Apply in Supabase SQL editor or migration runner.

CREATE TABLE IF NOT EXISTS candidate_coding_profiles_analysis (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Raw handles/usernames used during fetch
  leetcode_username VARCHAR(128),
  codeforces_handle VARCHAR(128),
  github_username VARCHAR(128),

  -- Raw fetched profile snapshots
  leetcode_stats JSONB,
  codeforces_stats JSONB,
  github_stats JSONB,

  -- AI-generated coding profile insights
  overall_profile_signal VARCHAR(32),
  coding_profiles_analysis JSONB,

  source VARCHAR(32) DEFAULT 'resume-upload',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_coding_profiles_analysis_user_id
  ON candidate_coding_profiles_analysis(user_id);

CREATE INDEX IF NOT EXISTS idx_candidate_coding_profiles_analysis_created_at
  ON candidate_coding_profiles_analysis(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_coding_profiles_analysis_signal
  ON candidate_coding_profiles_analysis(overall_profile_signal);

-- Optional trigger-style update helper for updated_at
CREATE OR REPLACE FUNCTION set_candidate_coding_profiles_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidate_coding_profiles_analysis_updated_at
  ON candidate_coding_profiles_analysis;

CREATE TRIGGER trg_candidate_coding_profiles_analysis_updated_at
BEFORE UPDATE ON candidate_coding_profiles_analysis
FOR EACH ROW
EXECUTE FUNCTION set_candidate_coding_profiles_analysis_updated_at();
