-- ============================================================
-- CITATION: PostgreSQL JSONB for flexible repository metadata
-- Source: PostgreSQL Documentation - JSON Types
-- Verbatim quote: "JSONB stores data in a decomposed binary format 
--          that is slightly slower to input but significantly faster to process"
-- URL: https://www.postgresql.org/docs/current/datatype-json.html
-- ============================================================

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main repositories table with audit trail
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    language VARCHAR(100),
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    url VARCHAR(500),
    pushed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional metadata as JSONB for flexibility
    metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Indexes for performance
    CONSTRAINT repos_name_unique UNIQUE (name)
);

-- ============================================================
-- CITATION: PostgreSQL partial indexes for active filtering
-- Source: PostgreSQL Documentation - Partial Indexes
-- Verbatim quote: "A partial index is an index built over a subset of a table"
-- URL: https://www.postgresql.org/docs/current/indexes-partial.html
-- ============================================================
CREATE INDEX idx_repos_stars ON repositories (stars DESC) WHERE stars > 0;
CREATE INDEX idx_repos_pushed ON repositories (pushed_at DESC);
CREATE INDEX idx_repos_language ON repositories (language);

-- Tag cloud cache table (pre-computed for fast 3D display)
CREATE TABLE tag_cloud_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key VARCHAR(255) NOT NULL, -- e.g., 'full', 'filter:python'
    entries JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes',
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires (expires_at)
);

-- ============================================================
-- CITATION: PostgreSQL LISTEN/NOTIFY for real-time updates
-- Source: PostgreSQL Documentation - Asynchronous Notification
-- Verbatim quote: "LISTEN and NOTIFY provide a simple form of 
--          signal or interprocess communication mechanism"
-- URL: https://www.postgresql.org/docs/current/sql-listen.html
-- ============================================================

-- Audit log for all changes (enables live sync)
CREATE TABLE repository_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    changed_by VARCHAR(100) DEFAULT CURRENT_USER,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to notify listeners on repository changes
CREATE OR REPLACE FUNCTION notify_repo_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'repo_changes',
        json_build_object(
            'action', TG_OP,
            'repo_id', COALESCE(NEW.id, OLD.id),
            'timestamp', NOW()
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for real-time notifications
CREATE TRIGGER trigger_repo_insert
    AFTER INSERT ON repositories
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

CREATE TRIGGER trigger_repo_update
    AFTER UPDATE ON repositories
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

CREATE TRIGGER trigger_repo_delete
    AFTER DELETE ON repositories
    FOR EACH ROW EXECUTE FUNCTION notify_repo_change();

-- ============================================================
-- CITATION: PostgreSQL materialized views for performance
-- Source: PostgreSQL Documentation - Materialized Views
-- Verbatim quote: "Materialized views are useful when fast access 
--          to pre-computed data is important"
-- URL: https://www.postgresql.org/docs/current/rules-materializedviews.html
-- ============================================================

CREATE MATERIALIZED VIEW repo_stats AS
SELECT 
    COUNT(*) as total_repos,
    SUM(stars) as total_stars,
    AVG(stars) as avg_stars,
    jsonb_object_agg(language, COUNT(*)) as language_breakdown
FROM repositories
WHERE pushed_at > NOW() - INTERVAL '90 days';

-- Refresh function (call via cron or pg_cron)
REFRESH MATERIALIZED VIEW CONCURRENTLY repo_stats;

-- Function to sync from GitHub API
CREATE OR REPLACE FUNCTION sync_from_github(username VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    repo_record RECORD;
    synced_count INTEGER := 0;
BEGIN
    -- This would be called from an external script
    -- For now, just return count
    RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CITATION: Row Level Security for multi-user documentation
-- Source: PostgreSQL Documentation - Row Security Policies
-- Verbatim quote: "Row level security adds fine-grained access control"
-- URL: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
-- ============================================================

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read
CREATE POLICY read_repos ON repositories
    FOR SELECT USING (true);

-- Policy: Only authenticated users can modify (with audit logging)
CREATE POLICY write_repos ON repositories
    FOR ALL USING (current_setting('role') = 'authenticated');

-- ============================================================
-- Index for full-text search (for filtering)
-- CITATION: PostgreSQL Full-Text Search
-- Source: PostgreSQL Documentation - Text Search
-- Verbatim quote: "Full-text searching allows matching documents with queries"
-- URL: https://www.postgresql.org/docs/current/textsearch.html
-- ============================================================

ALTER TABLE repositories ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || COALESCE(description, ''))) STORED;

CREATE INDEX idx_repo_search ON repositories USING GIN (search_vector);
-- ============================================================
-- Console Error Logging Table
-- Captures browser console errors for debugging
-- ============================================================

CREATE TABLE IF NOT EXISTS console_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_type VARCHAR(100),
    url VARCHAR(500),
    user_agent TEXT,
    session_id UUID,
    repo_context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT
);

-- Index for quick queries
CREATE INDEX idx_console_errors_created ON console_errors(created_at DESC);
CREATE INDEX idx_console_errors_type ON console_errors(error_type);
CREATE INDEX idx_console_errors_resolved ON console_errors(resolved);

-- Function to log error from API
CREATE OR REPLACE FUNCTION log_console_error(
    p_error_message TEXT,
    p_error_stack TEXT,
    p_error_type VARCHAR(100),
    p_url VARCHAR(500),
    p_user_agent TEXT,
    p_session_id UUID DEFAULT NULL,
    p_repo_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_error_id UUID;
BEGIN
    INSERT INTO console_errors (
        error_message, error_stack, error_type, url, 
        user_agent, session_id, repo_context, created_at
    )
    VALUES (
        p_error_message, p_error_stack, p_error_type, p_url,
        p_user_agent, p_session_id, p_repo_context, NOW()
    )
    RETURNING id INTO v_error_id;
    
    -- Send notification for new errors
    PERFORM pg_notify(
        'console_error',
        json_build_object(
            'error_id', v_error_id,
            'message', p_error_message,
            'type', p_error_type,
            'timestamp', NOW()
        )::text
    );
    
    RETURN v_error_id;
END;
$$ LANGUAGE plpgsql;

-- View to see unresolved errors
CREATE OR REPLACE VIEW unresolved_errors AS
SELECT 
    id,
    error_message,
    error_type,
    url,
    created_at,
    CASE 
        WHEN created_at > NOW() - INTERVAL '1 hour' THEN 'Critical'
        WHEN created_at > NOW() - INTERVAL '1 day' THEN 'Recent'
        ELSE 'Old'
    END as severity
FROM console_errors
WHERE resolved = FALSE
ORDER BY created_at DESC;

-- Function to get error statistics
CREATE OR REPLACE FUNCTION get_error_stats(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
    error_type VARCHAR(100),
    count BIGINT,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    resolved_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.error_type,
        COUNT(*) as count,
        MIN(ce.created_at) as first_seen,
        MAX(ce.created_at) as last_seen,
        COUNT(*) FILTER (WHERE ce.resolved = TRUE) as resolved_count
    FROM console_errors ce
    WHERE ce.created_at > NOW() - (days_back || ' days')::INTERVAL
    GROUP BY ce.error_type
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;
