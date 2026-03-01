-- ============================================================
--  ScholarVision · Database Schema
--  AI-Driven Student Personal Assistant
--  Stack: PostgreSQL 16 · Random Forests · Decision Trees · XAI
-- ============================================================

-- Extension required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
--  SECTION 1 — AUTHENTICATION & IDENTITY
-- ============================================================

-- 1.1  Main user account (source of truth for user_id)
CREATE TABLE users (
    user_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email      VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- 1.2  OAuth identities (e.g. Google SSO)
CREATE TABLE user_identities (
    identity_id       SERIAL      PRIMARY KEY,
    user_id           UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    provider          VARCHAR(50) NOT NULL,           -- 'google', 'microsoft', etc.
    provider_user_id  VARCHAR(255) UNIQUE NOT NULL,   -- provider's own subject ID
    access_token      TEXT,
    refresh_token     TEXT,
    profile_picture_url TEXT,
    last_login        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  SECTION 2 — STUDENT PROFILE
-- ============================================================

-- 2.1  Human-readable profile fields
CREATE TABLE student_profiles (
    user_id          UUID         PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    full_name        VARCHAR(255),
    date_of_birth    DATE,
    major            VARCHAR(100),                    -- e.g. "Computer Science"
    university_name  VARCHAR(255),
    enrollment_year  INT,
    current_year     INT,                             -- 1 = first year, etc.
    location         VARCHAR(100),
    bio              TEXT,
    updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- 2.2  ML feature vector (encoded/numerical — fed directly to RF/DT models)
--      Kept separate so it can be rebuilt from raw tables without touching profiles.
CREATE TABLE student_features (
    feature_id               SERIAL    PRIMARY KEY,
    user_id                  UUID      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    snapshot_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,   -- when this vector was computed
    age_group                INT,       -- bucketed: 1=18-20, 2=21-23, 3=24+
    location_tier            INT,       -- 1=Tier-1 City, 2=Suburban, 3=Rural
    major_encoded            INT,       -- numerical label for study field
    uni_ranking_percentile   FLOAT,     -- 0.0–1.0
    avg_daily_study_mins     INT,       -- rolling 30-day average
    total_extracurricular    INT,       -- count of active activities
    internship_count         INT,
    certifications_count     INT,
    soft_skills_score        FLOAT,     -- 0.0–1.0, aggregated from peer/prof reviews
    library_visits_30d       INT,       -- passive: physical + digital visits
    avg_session_focus_score  FLOAT,     -- passive: focus ratio during study sessions
    peer_collaboration_score FLOAT      -- passive: group-work engagement metric
);


-- ============================================================
--  SECTION 3 — ACADEMIC TRACKING
-- ============================================================

-- 3.1  Semester-level GPA progression (time-series — captures growth trajectory)
CREATE TABLE academic_performance (
    performance_id    SERIAL    PRIMARY KEY,
    user_id           UUID      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    semester_index    INT       NOT NULL,   -- 1, 2, 3 … (chronological)
    academic_year     VARCHAR(9),           -- e.g. "2024-2025"
    gpa               FLOAT     CHECK (gpa BETWEEN 0.0 AND 4.0),
    credits_completed INT,
    credits_attempted INT,
    recorded_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.2  Individual course enrolments
CREATE TABLE course_enrollments (
    enrollment_id  SERIAL       PRIMARY KEY,
    user_id        UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    course_code    VARCHAR(20)  NOT NULL,
    course_name    VARCHAR(255),
    semester_index INT,
    status         VARCHAR(20)  DEFAULT 'active'   -- 'active', 'completed', 'withdrawn'
);

-- 3.3  Assessment results (assignments, exams, quizzes)
CREATE TABLE assessment_results (
    result_id     SERIAL      PRIMARY KEY,
    enrollment_id INT         NOT NULL REFERENCES course_enrollments(enrollment_id) ON DELETE CASCADE,
    assessment_type VARCHAR(50),                   -- 'exam', 'assignment', 'quiz', 'project'
    title         VARCHAR(255),
    score         FLOAT,
    max_score     FLOAT,
    weight        FLOAT,                           -- percentage weight in final grade
    submitted_at  TIMESTAMP
);


-- ============================================================
--  SECTION 4 — PASSIVE DATA COLLECTION
--  Raw signals gathered unobtrusively from the student's environment
-- ============================================================

-- 4.1  Study sessions (app-tracked or calendar-synced)
CREATE TABLE study_sessions (
    session_id       SERIAL    PRIMARY KEY,
    user_id          UUID      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    started_at       TIMESTAMP NOT NULL,
    ended_at         TIMESTAMP,
    duration_mins    INT       GENERATED ALWAYS AS (
                         EXTRACT(EPOCH FROM (ended_at - started_at))::INT / 60
                     ) STORED,
    subject_tag      VARCHAR(100),
    focus_score      FLOAT     CHECK (focus_score BETWEEN 0.0 AND 1.0),   -- e.g. from Pomodoro breaks ratio
    location_type    VARCHAR(50)    -- 'home', 'library', 'campus', 'cafe'
);

-- 4.2  Application / platform usage logs (e.g. LMS, YouTube Edu, Anki)
CREATE TABLE app_usage_logs (
    log_id        SERIAL      PRIMARY KEY,
    user_id       UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    app_name      VARCHAR(100) NOT NULL,
    category      VARCHAR(50),             -- 'educational', 'social', 'entertainment'
    duration_mins INT,
    logged_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- 4.3  Library / resource access (physical badge-in or digital portal)
CREATE TABLE library_access_logs (
    access_id    SERIAL    PRIMARY KEY,
    user_id      UUID      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    access_type  VARCHAR(20) DEFAULT 'physical',   -- 'physical', 'digital'
    resource_tag VARCHAR(100),                     -- e.g. "IEEE database", "Reading Room"
    accessed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  SECTION 5 — ENRICHMENT ACTIVITIES
-- ============================================================

-- 5.1  Extracurricular activities
CREATE TABLE extracurricular_activities (
    activity_id   SERIAL       PRIMARY KEY,
    user_id       UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    role          VARCHAR(100),            -- 'member', 'president', 'volunteer', etc.
    category      VARCHAR(100),            -- 'sports', 'society', 'volunteering', etc.
    started_at    DATE,
    ended_at      DATE,                    -- NULL = ongoing
    hours_per_week FLOAT
);

-- 5.2  Internships & work experience
CREATE TABLE internships (
    internship_id  SERIAL       PRIMARY KEY,
    user_id        UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    company_name   VARCHAR(255),
    role_title     VARCHAR(255),
    is_paid        BOOLEAN      DEFAULT TRUE,
    started_at     DATE,
    ended_at       DATE,
    is_top_tier    BOOLEAN      DEFAULT FALSE   -- e.g. FAANG, Big-4, etc.
);

-- 5.3  Certifications & micro-credentials
CREATE TABLE certifications (
    cert_id        SERIAL       PRIMARY KEY,
    user_id        UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    issuer         VARCHAR(255),            -- 'Coursera', 'AWS', 'Cisco', etc.
    issued_at      DATE,
    expires_at     DATE,
    credential_url TEXT
);


-- ============================================================
--  SECTION 6 — SOFT SKILLS & PEER FEEDBACK
-- ============================================================

-- 6.1  Peer reviews (360° feedback)
CREATE TABLE peer_reviews (
    review_id       SERIAL    PRIMARY KEY,
    reviewer_id     UUID      NOT NULL REFERENCES users(user_id),
    reviewee_id     UUID      NOT NULL REFERENCES users(user_id),
    communication   FLOAT     CHECK (communication BETWEEN 0.0 AND 5.0),
    teamwork        FLOAT     CHECK (teamwork BETWEEN 0.0 AND 5.0),
    leadership      FLOAT     CHECK (leadership BETWEEN 0.0 AND 5.0),
    problem_solving FLOAT     CHECK (problem_solving BETWEEN 0.0 AND 5.0),
    overall_comment TEXT,
    reviewed_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6.2  Professor / tutor feedback
CREATE TABLE professor_feedback (
    feedback_id      SERIAL    PRIMARY KEY,
    user_id          UUID      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    professor_name   VARCHAR(255),
    course_code      VARCHAR(20),
    engagement_score FLOAT     CHECK (engagement_score BETWEEN 0.0 AND 5.0),
    participation    FLOAT     CHECK (participation BETWEEN 0.0 AND 5.0),
    comments         TEXT,
    given_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  SECTION 7 — CAREER OUTCOMES  (Target Labels for ML)
-- ============================================================

CREATE TABLE career_outcomes (
    outcome_id         SERIAL      PRIMARY KEY,
    user_id            UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    outcome_label      VARCHAR(50) NOT NULL,   -- 'Placed', 'Unemployed', 'Higher_Ed', 'Self_Employed'
    salary_starting    INT,                    -- annual, local currency (£ / $ / ₹)
    is_top_tier_company BOOLEAN     DEFAULT FALSE,
    time_to_offer_days INT,                    -- days from graduation to first offer
    recorded_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  SECTION 8 — AI / ML LAYER
-- ============================================================

-- 8.1  Model prediction log (stores every inference made)
CREATE TABLE ml_predictions (
    prediction_id   SERIAL      PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    model_version   VARCHAR(50) NOT NULL,       -- e.g. 'rf_v1.2', 'dt_v0.9'
    model_type      VARCHAR(50),                -- 'random_forest', 'decision_tree'
    feature_snapshot_id INT      REFERENCES student_features(feature_id),
    predicted_label VARCHAR(100),               -- output class
    confidence      FLOAT,                      -- 0.0–1.0
    predicted_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- 8.2  Explainable AI — feature importance per prediction (SHAP / LIME values)
CREATE TABLE xai_explanations (
    explanation_id  SERIAL    PRIMARY KEY,
    prediction_id   INT       NOT NULL REFERENCES ml_predictions(prediction_id) ON DELETE CASCADE,
    feature_name    VARCHAR(100) NOT NULL,
    shap_value      FLOAT,      -- positive = pushes toward predicted class
    importance_rank INT,        -- 1 = most influential for this prediction
    direction       VARCHAR(10) -- 'positive' | 'negative'
);

-- ============================================================
--  SECTION 9 — FILE IMPORT & PARSING
-- ============================================================

-- 9.1  Uploaded file registry
CREATE TABLE uploaded_files (
    file_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         REFERENCES users(user_id) ON DELETE SET NULL,
    session_id    VARCHAR(64),                 -- anonymous browser session UUID
    original_name VARCHAR(255) NOT NULL,
    stored_name   VARCHAR(255) NOT NULL,       -- UUID-based filename on disk
    file_type     VARCHAR(20)  NOT NULL,       -- pdf, docx, csv, xlsx, txt, png, jpg
    file_size     BIGINT,
    category      VARCHAR(50)  DEFAULT 'Other',
    notes         TEXT,
    storage_path  TEXT         NOT NULL,
    parse_status  VARCHAR(20)  DEFAULT 'pending',  -- pending | done | failed
    raw_text      TEXT,                        -- full extracted text for search/NLP
    uploaded_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- 9.2  Structured grades/scores extracted from uploaded files
CREATE TABLE parsed_grades (
    grade_id      SERIAL       PRIMARY KEY,
    file_id       UUID         NOT NULL REFERENCES uploaded_files(file_id) ON DELETE CASCADE,
    user_id       UUID         REFERENCES users(user_id) ON DELETE SET NULL,
    course_name   VARCHAR(255),
    course_code   VARCHAR(50),
    grade_letter  VARCHAR(5),                  -- A+, B, C-, etc.
    score         FLOAT,
    max_score     FLOAT,
    percentage    FLOAT,                       -- normalised 0–100
    semester      VARCHAR(50),
    source_row    INT,                         -- row number in original table (CSV/XLSX)
    extracted_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- 9.3  Key text snippets extracted from documents (feedback, comments, notes)
CREATE TABLE parsed_text_snippets (
    snippet_id    SERIAL       PRIMARY KEY,
    file_id       UUID         NOT NULL REFERENCES uploaded_files(file_id) ON DELETE CASCADE,
    snippet_type  VARCHAR(50),                 -- 'feedback', 'comment', 'grade_line', 'heading'
    content       TEXT         NOT NULL,
    page_number   INT,
    extracted_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  SECTION 10 — APPLE HEALTH IMPORT
-- ============================================================

-- 10.1  One record per JSON payload received
CREATE TABLE health_imports (
    import_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        REFERENCES users(user_id) ON DELETE SET NULL,
    session_id     VARCHAR(64),
    source_user_id VARCHAR(100),              -- user_id field from the JSON
    sync_timestamp TIMESTAMP,
    client_version VARCHAR(20),
    metric_count   INT         DEFAULT 0,
    imported_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- 10.2  Individual health metrics extracted from each import
CREATE TABLE health_metrics (
    metric_id        SERIAL      PRIMARY KEY,
    import_id        UUID        NOT NULL REFERENCES health_imports(import_id) ON DELETE CASCADE,
    user_id          UUID        REFERENCES users(user_id) ON DELETE SET NULL,
    type             VARCHAR(100) NOT NULL,   -- step_count, heart_rate, sleep_analysis, …
    data_class       VARCHAR(50),             -- 'quantity' | 'category'
    value_num        FLOAT,                   -- numeric value (quantity metrics)
    value_cat        VARCHAR(100),            -- categorical value (e.g. 'REM', 'AWAKE')
    unit             VARCHAR(50),             -- count, count/min, kcal, …
    start_time       TIMESTAMP   NOT NULL,
    end_time         TIMESTAMP,
    source_device    VARCHAR(100),            -- e.g. 'Watch6,1', 'iPhone14,2'
    was_user_entered BOOLEAN     DEFAULT FALSE,
    recorded_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_health_metrics_import ON health_metrics(import_id);
CREATE INDEX idx_health_metrics_type   ON health_metrics(type);

-- ============================================================
--  SECTION 11 — APP USAGE IMPORT
-- ============================================================

CREATE TABLE app_usage_imports (
    import_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     VARCHAR(64) NOT NULL,
    sync_timestamp TIMESTAMP,
    client_version VARCHAR(20),
    log_count      INT         DEFAULT 0,
    imported_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_usage_entries (
    entry_id      SERIAL      PRIMARY KEY,
    import_id     UUID        NOT NULL REFERENCES app_usage_imports(import_id) ON DELETE CASCADE,
    app_name      VARCHAR(100) NOT NULL,
    category      VARCHAR(50),   -- 'Productive' | 'Neutral' | 'Distracting'
    duration_mins INT         NOT NULL,
    logged_date   DATE        NOT NULL
);

CREATE INDEX idx_app_usage_entries_import ON app_usage_entries(import_id);

-- ============================================================
--  SECTION 12 — STUDY SESSION IMPORT
-- ============================================================

CREATE TABLE study_imports (
    import_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id     VARCHAR(64) NOT NULL,
    sync_timestamp TIMESTAMP,
    client_version VARCHAR(20),
    session_count  INT         DEFAULT 0,
    imported_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE study_entries (
    entry_id      SERIAL      PRIMARY KEY,
    import_id     UUID        NOT NULL REFERENCES study_imports(import_id) ON DELETE CASCADE,
    started_at    TIMESTAMP   NOT NULL,
    ended_at      TIMESTAMP   NOT NULL,
    duration_mins INT         NOT NULL,
    subject_tag   VARCHAR(100),
    breaks_taken  INT         DEFAULT 0,
    notes         TEXT
);

CREATE INDEX idx_study_entries_import ON study_entries(import_id);

-- ============================================================
--  SECTION 13 — ATTENTION / FOCUS SESSION ENTRIES
-- ============================================================

CREATE TABLE attention_entries (
    entry_id      SERIAL      PRIMARY KEY,
    session_id    VARCHAR(64) NOT NULL,
    duration_mins INT         NOT NULL CHECK (duration_mins >= 1),
    breaks_taken  INT         NOT NULL DEFAULT 0,
    quality       VARCHAR(20) NOT NULL DEFAULT 'Medium',   -- 'High' | 'Medium' | 'Low'
    logged_date   DATE        NOT NULL,
    source        VARCHAR(20) NOT NULL DEFAULT 'manual',   -- 'manual' | 'timer'
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attention_entries_session ON attention_entries(session_id);


-- 8.3  Improvement recommendations  (generated from XAI output)
CREATE TABLE improvement_recommendations (
    rec_id          SERIAL    PRIMARY KEY,
    user_id         UUID      NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    prediction_id   INT       REFERENCES ml_predictions(prediction_id),
    priority        INT       DEFAULT 1,        -- 1 = highest priority
    area            VARCHAR(100),               -- 'study_habits', 'gpa', 'extracurricular', etc.
    recommendation  TEXT      NOT NULL,
    xai_basis       TEXT,                       -- human-readable explanation why (from SHAP)
    is_actioned     BOOLEAN   DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
