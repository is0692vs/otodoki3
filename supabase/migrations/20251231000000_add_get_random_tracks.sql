-- Migration: Add get_random_tracks RPC function
-- Purpose: Fetch random tracks from track_pool with exclusion support
-- This function provides database-level randomization to prevent artist clustering

-- Enable required extension for efficient random sampling
CREATE EXTENSION IF NOT EXISTS tsm_system_rows;

-- Create the get_random_tracks function
CREATE OR REPLACE FUNCTION get_random_tracks(
    limit_count int DEFAULT 10,
    excluded_track_ids text[] DEFAULT NULL
)
RETURNS TABLE (
    track_id text,
    track_name text,
    artist_name text,
    collection_name text,
    preview_url text,
    artwork_url text,
    track_view_url text,
    genre text,
    release_date text,
    metadata jsonb,
    fetched_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    validated_limit int;
    sample_size int;
BEGIN
    -- Validate and normalize limit_count to range 1-100
    validated_limit := GREATEST(1, LEAST(100, COALESCE(limit_count, 10)));
    
    -- Calculate sample size (4x the limit to ensure enough candidates after filtering)
    sample_size := validated_limit * 4;
    
    -- Return random tracks with exclusion filter
    RETURN QUERY
    SELECT 
        tp.track_id,
        tp.track_name,
        tp.artist_name,
        tp.collection_name,
        tp.preview_url,
        tp.artwork_url,
        tp.track_view_url,
        tp.genre,
        tp.release_date,
        tp.metadata,
        tp.fetched_at
    FROM track_pool tp
    TABLESAMPLE SYSTEM_ROWS(sample_size)
    WHERE 
        -- Exclude tracks if exclusion list is provided and not empty
        (excluded_track_ids IS NULL 
         OR array_length(excluded_track_ids, 1) IS NULL 
         OR tp.track_id <> ALL(excluded_track_ids))
    ORDER BY random()
    LIMIT validated_limit;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Set security policies (service_role only for server-side API usage)
REVOKE ALL ON FUNCTION get_random_tracks(int, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_random_tracks(int, text[]) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_random_tracks(int, text[]) IS 
'Fetches random tracks from track_pool with optional exclusion list. 
Uses TABLESAMPLE for efficient random sampling at database level.
Parameters:
  - limit_count: Number of tracks to return (1-100, default 10)
  - excluded_track_ids: Array of track IDs (as text) to exclude (optional)
Returns: Table of track records with all necessary fields for API response.
Security: Only accessible via service_role for server-side API usage.';
