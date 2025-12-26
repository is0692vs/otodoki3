CREATE OR REPLACE FUNCTION get_random_artists(limit_count int DEFAULT 5)
RETURNS TABLE (artist_name text) AS $$
  SELECT artist_name FROM (
    SELECT DISTINCT artist_name FROM track_pool
  ) AS unique_artists
  ORDER BY random()
  LIMIT limit_count;
$$ LANGUAGE sql STABLE;