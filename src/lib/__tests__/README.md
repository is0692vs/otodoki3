# テスト実行ガイド

## 必要な環境変数

テストを実行するには、以下の環境変数が必要です：

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
TRACK_POOL_MAX_SIZE=10  # テスト用は小さい値を推奨
```

## ローカルでのテスト実行

### 1. 環境変数の設定

```bash
# .env.local ファイルを作成
cp .env.example .env.local

# または直接環境変数を設定
export NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
export TRACK_POOL_MAX_SIZE=10
```

### 2. テストの実行

```bash
# すべてのテストを実行
npm test

# 特定のテストファイルのみ実行
npm test -- src/lib/refill-methods/__tests__/chart.test.ts

# カバレッジ付きで実行
npm run test:coverage

# ウォッチモードで実行
npm run test:watch
```

## CI/CD での実行

GitHub Actions では、リポジトリ変数から環境変数を自動的に読み込みます：

- `NEXT_PUBLIC_SUPABASE_URL_TEST`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST`
- `TRACK_POOL_MAX_SIZE_TEST`

## テストの種類

### 単体テスト（モック使用）

- `src/lib/refill-methods/__tests__/chart.test.ts`: Apple RSS API のモックテスト
- `src/types/__tests__/track-pool.test.ts`: ユーティリティ関数のテスト

これらのテストは Supabase 接続なしで実行できます。

### 統合テスト（実際のSupabase接続）

- `src/lib/__tests__/track-pool.test.ts`: track_pool テーブルを使用した統合テスト

これらのテストは実際の Supabase データベース接続が必要です。

## トラブルシューティング

### Supabase エラー

環境変数が設定されていない場合、以下のエラーが表示されます：

```
Supabase URL and Anon Key must be defined in environment variables.
```

解決方法：環境変数を正しく設定してください。

### テストデータのクリーンアップ

統合テストは自動的にテストデータをクリーンアップします。
手動でクリーンアップが必要な場合：

```sql
DELETE FROM track_pool WHERE metadata->>'test_data' = 'true';
```
