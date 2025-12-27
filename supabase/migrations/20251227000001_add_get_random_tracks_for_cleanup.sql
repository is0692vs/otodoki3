-- tsm_system_rows拡張機能を有効化（TABLESAMPLE SYSTEM_ROWS に必要）
CREATE EXTENSION IF NOT EXISTS tsm_system_rows;

-- ランダムなトラックを取得するRPC関数（cleanup-pool用）
CREATE OR REPLACE FUNCTION get_random_tracks_for_cleanup(limit_count int DEFAULT 50)
RETURNS TABLE (id uuid, artist_name text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  -- limit_countのバリデーション（1〜200の範囲に制限）
  SELECT id, artist_name 
  FROM track_pool
  TABLESAMPLE SYSTEM_ROWS(
    CASE 
      WHEN limit_count < 1 THEN 1
      WHEN limit_count > 200 THEN 200
      ELSE limit_count
    END * 2
  )
  LIMIT CASE 
    WHEN limit_count < 1 THEN 1
    WHEN limit_count > 200 THEN 200
    ELSE limit_count
  END;
$$;

-- 権限設定: PUBLIC から実行権限を剥奪
REVOKE ALL ON FUNCTION get_random_tracks_for_cleanup(int) FROM PUBLIC;

-- service_role のみに実行権限を付与
GRANT EXECUTE ON FUNCTION get_random_tracks_for_cleanup(int) TO service_role;
