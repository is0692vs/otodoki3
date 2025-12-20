// テスト実行前に環境変数をテスト用に設定
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL_TEST ||
  "http://localhost:54321";

process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST ||
  "test-key";

if (process.env.TRACK_POOL_MAX_SIZE_TEST) {
  process.env.TRACK_POOL_MAX_SIZE = process.env.TRACK_POOL_MAX_SIZE_TEST;
}
