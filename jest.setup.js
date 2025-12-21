// .env.local から環境変数を読み込む
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.local" });

// テスト用環境変数を設定（_TEST サフィックス付きの値を優先して使用）
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL_TEST ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "http://localhost:54321";

process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "test-key";

if (process.env.TRACK_POOL_MAX_SIZE_TEST) {
  process.env.TRACK_POOL_MAX_SIZE = process.env.TRACK_POOL_MAX_SIZE_TEST;
}
