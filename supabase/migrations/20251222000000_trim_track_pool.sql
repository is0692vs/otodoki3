-- Create trim_track_pool function to atomically delete oldest rows when pool exceeds max_size
CREATE OR REPLACE FUNCTION public.trim_track_pool(max_size integer)
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  cur_count bigint;
  to_delete bigint;
BEGIN
  SELECT COUNT(*) INTO cur_count FROM public.track_pool;
  to_delete := cur_count - max_size;
  IF to_delete <= 0 THEN
    deleted_count := 0;
    RETURN;
  END IF;

  DELETE FROM public.track_pool
  WHERE id IN (
    SELECT id FROM public.track_pool
    ORDER BY fetched_at ASC NULLS FIRST, created_at ASC NULLS FIRST
    LIMIT to_delete
  );

  GET DIAGNOSTICS deleted_count := ROW_COUNT;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon role if needed (uncomment if required)
-- GRANT EXECUTE ON FUNCTION public.trim_track_pool(integer) TO anon;