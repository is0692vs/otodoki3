-- ランダムなトラックを取得するRPC関数（cleanup-pool用）
CREATE OR REPLACE FUNCTION get_random_tracks_for_cleanup(limit_count int DEFAULT 50)
RETURNS TABLE (id text, artist text) AS $$
  SELECT id, artist 
  FROM track_pool
  TABLESAMPLE SYSTEM_ROWS(limit_count * 2)
  LIMIT limit_count;
$$ LANGUAGE sql VOLATILE;
