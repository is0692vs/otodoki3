-- E2E Test用の track_pool seed data
-- CI環境で必ずディスカバリーに表示できるtrack_idを投入する
--
-- 注意:
-- - track_idは重複しないユニークな値を使用（9000000001〜）
-- - preview_url, artwork_urlはUIで必須なので、ダミーのHTTPS URLを設定
-- - metadataとfetched_atはNOT NULL制約を満たすため設定
-- - 既存データがある場合でも壊れないように ON CONFLICT を使用

INSERT INTO public.track_pool (
  track_id,
  track_name,
  artist_name,
  collection_name,
  preview_url,
  artwork_url,
  track_view_url,
  genre,
  metadata,
  fetched_at
) VALUES
  (9000000001, 'E2E Test Track 01', 'E2E Test Artist A', 'E2E Test Album', 'https://example.com/preview/01.m4a', 'https://example.com/artwork/01.jpg', 'https://music.apple.com/jp/album/test/1', 'Pop', '{}'::jsonb, now()),
  (9000000002, 'E2E Test Track 02', 'E2E Test Artist B', 'E2E Test Album', 'https://example.com/preview/02.m4a', 'https://example.com/artwork/02.jpg', 'https://music.apple.com/jp/album/test/2', 'Rock', '{}'::jsonb, now()),
  (9000000003, 'E2E Test Track 03', 'E2E Test Artist C', 'E2E Test Album', 'https://example.com/preview/03.m4a', 'https://example.com/artwork/03.jpg', 'https://music.apple.com/jp/album/test/3', 'Jazz', '{}'::jsonb, now()),
  (9000000004, 'E2E Test Track 04', 'E2E Test Artist D', 'E2E Test Album', 'https://example.com/preview/04.m4a', 'https://example.com/artwork/04.jpg', 'https://music.apple.com/jp/album/test/4', 'Electronic', '{}'::jsonb, now()),
  (9000000005, 'E2E Test Track 05', 'E2E Test Artist E', 'E2E Test Album', 'https://example.com/preview/05.m4a', 'https://example.com/artwork/05.jpg', 'https://music.apple.com/jp/album/test/5', 'Classical', '{}'::jsonb, now()),
  (9000000006, 'E2E Test Track 06', 'E2E Test Artist F', 'E2E Test Album', 'https://example.com/preview/06.m4a', 'https://example.com/artwork/06.jpg', 'https://music.apple.com/jp/album/test/6', 'Hip-Hop', '{}'::jsonb, now()),
  (9000000007, 'E2E Test Track 07', 'E2E Test Artist G', 'E2E Test Album', 'https://example.com/preview/07.m4a', 'https://example.com/artwork/07.jpg', 'https://music.apple.com/jp/album/test/7', 'Country', '{}'::jsonb, now()),
  (9000000008, 'E2E Test Track 08', 'E2E Test Artist H', 'E2E Test Album', 'https://example.com/preview/08.m4a', 'https://example.com/artwork/08.jpg', 'https://music.apple.com/jp/album/test/8', 'R&B', '{}'::jsonb, now()),
  (9000000009, 'E2E Test Track 09', 'E2E Test Artist I', 'E2E Test Album', 'https://example.com/preview/09.m4a', 'https://example.com/artwork/09.jpg', 'https://music.apple.com/jp/album/test/9', 'Metal', '{}'::jsonb, now()),
  (9000000010, 'E2E Test Track 10', 'E2E Test Artist J', 'E2E Test Album', 'https://example.com/preview/10.m4a', 'https://example.com/artwork/10.jpg', 'https://music.apple.com/jp/album/test/10', 'Folk', '{}'::jsonb, now()),
  (9000000011, 'E2E Test Track 11', 'E2E Test Artist K', 'E2E Test Album', 'https://example.com/preview/11.m4a', 'https://example.com/artwork/11.jpg', 'https://music.apple.com/jp/album/test/11', 'Reggae', '{}'::jsonb, now()),
  (9000000012, 'E2E Test Track 12', 'E2E Test Artist L', 'E2E Test Album', 'https://example.com/preview/12.m4a', 'https://example.com/artwork/12.jpg', 'https://music.apple.com/jp/album/test/12', 'Blues', '{}'::jsonb, now()),
  (9000000013, 'E2E Test Track 13', 'E2E Test Artist M', 'E2E Test Album', 'https://example.com/preview/13.m4a', 'https://example.com/artwork/13.jpg', 'https://music.apple.com/jp/album/test/13', 'Soul', '{}'::jsonb, now()),
  (9000000014, 'E2E Test Track 14', 'E2E Test Artist N', 'E2E Test Album', 'https://example.com/preview/14.m4a', 'https://example.com/artwork/14.jpg', 'https://music.apple.com/jp/album/test/14', 'Funk', '{}'::jsonb, now()),
  (9000000015, 'E2E Test Track 15', 'E2E Test Artist O', 'E2E Test Album', 'https://example.com/preview/15.m4a', 'https://example.com/artwork/15.jpg', 'https://music.apple.com/jp/album/test/15', 'Disco', '{}'::jsonb, now()),
  (9000000016, 'E2E Test Track 16', 'E2E Test Artist P', 'E2E Test Album', 'https://example.com/preview/16.m4a', 'https://example.com/artwork/16.jpg', 'https://music.apple.com/jp/album/test/16', 'Punk', '{}'::jsonb, now()),
  (9000000017, 'E2E Test Track 17', 'E2E Test Artist Q', 'E2E Test Album', 'https://example.com/preview/17.m4a', 'https://example.com/artwork/17.jpg', 'https://music.apple.com/jp/album/test/17', 'Indie', '{}'::jsonb, now()),
  (9000000018, 'E2E Test Track 18', 'E2E Test Artist R', 'E2E Test Album', 'https://example.com/preview/18.m4a', 'https://example.com/artwork/18.jpg', 'https://music.apple.com/jp/album/test/18', 'Alternative', '{}'::jsonb, now()),
  (9000000019, 'E2E Test Track 19', 'E2E Test Artist S', 'E2E Test Album', 'https://example.com/preview/19.m4a', 'https://example.com/artwork/19.jpg', 'https://music.apple.com/jp/album/test/19', 'Dance', '{}'::jsonb, now()),
  (9000000020, 'E2E Test Track 20', 'E2E Test Artist T', 'E2E Test Album', 'https://example.com/preview/20.m4a', 'https://example.com/artwork/20.jpg', 'https://music.apple.com/jp/album/test/20', 'House', '{}'::jsonb, now())
ON CONFLICT (track_id) DO NOTHING;
