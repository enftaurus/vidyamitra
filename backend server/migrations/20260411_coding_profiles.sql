-- Stores coding profile usernames for each user.
-- Used as fallback when resume upload/build requests omit profile handles.

CREATE TABLE IF NOT EXISTS coding_profiles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,

    leetcode_username VARCHAR(100),
    codeforces_username VARCHAR(100),
    codechef_username VARCHAR(100),
    github_username VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coding_profiles_user_id
    ON coding_profiles(user_id);
