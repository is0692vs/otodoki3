-- playlists RLS
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own playlists"
  ON playlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- playlist_tracks RLS
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own playlist tracks"
  ON playlist_tracks FOR ALL
  USING (
    playlist_id IN (
      SELECT id FROM playlists WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    playlist_id IN (
      SELECT id FROM playlists WHERE user_id = auth.uid()
    )
  );
