-- 1. Core Student Profile (The Features)
CREATE TABLE student_features (
    user_id UUID PRIMARY KEY,
    age_group INT, -- Categorized (e.g., 18-21 = 1)
    location_tier INT, -- 1 = Tier 1 City, 2 = Rural, etc.
    major_encoded INT, -- Numerical ID for the study field
    uni_ranking_percentile FLOAT, -- 0.0 to 1.0
    avg_daily_study_mins INT,
    total_extracurricular_count INT,
    internship_count INT,
    certifications_count INT,
    soft_skills_score FLOAT -- Aggregated from peer/prof reviews
);

-- 2. Performance Tracking (The Time-Series Data)
-- This allows the model to see 'Growth' as a feature
CREATE TABLE academic_performance (
    performance_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES student_features(user_id),
    semester_index INT, -- 1, 2, 3...
    gpa FLOAT,
    credits_completed INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Target Labels (What we are predicting)
CREATE TABLE career_outcomes (
    outcome_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES student_features(user_id),
    outcome_label VARCHAR(50), -- e.g., 'Placed', 'Unemployed', 'Higher_Ed'
    salary_starting INT,
    is_top_tier_company BOOLEAN
);

--- User sign up / login page setup

-- 1. Main User Table (Internal reference)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. OAuth Identities (The "Google" link)
CREATE TABLE user_identities (
    identity_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    provider VARCHAR(50), -- e.g., 'google'
    provider_user_id VARCHAR(255) UNIQUE, -- Google's 'sub' (subject) ID
    access_token TEXT, -- Temporary key for API calls
    refresh_token TEXT, -- Key to get new access tokens
    profile_picture_url TEXT,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);