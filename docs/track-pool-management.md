# 楽曲プール管理機能

グローバルな楽曲プール（`track_pool`テーブル）を管理するユーティリティ機能です。

## 実装内容

### 1. 環境変数

[.env.local](.env.local) に以下を追加しました：

```
TRACK_POOL_MAX_SIZE=10000
```

### 2. 型定義

[src/types/track-pool.ts](src/types/track-pool.ts) に以下の型を定義：

- `RefillTiming`: 補充タイミング（'ondemand' | 'cron'）
- `RefillMethod`: 補充方法（'chart' | 'keyword' | 'random'）
- `RefillConfig`: 補充設定
- `Track`: 楽曲情報

### 3. 楽曲プール管理ユーティリティ

[src/lib/track-pool.ts](src/lib/track-pool.ts) に以下の関数を実装：

#### `getTracksFromPool(count: number): Promise<Track[]>`

- `track_pool`テーブルから指定数の楽曲を取得
- `fetched_at`の昇順でソート（古いものから取得）

#### `addTracksToPool(tracks: Track[], options?: { method: string; weight: number }): Promise<void>`

- 楽曲をプールに追加（`track_id`で重複排除、upsert）
- 追加後に`trimPool()`を自動実行してサイズ上限を管理

#### `getPoolSize(): Promise<number>`

- 現在のプールサイズ（曲数）を取得

#### `trimPool(maxSize: number): Promise<void>`

- プールサイズが上限を超えた場合、`fetched_at`が古いものから削除

### 4. チャート補充ロジック

[src/lib/refill-methods/chart.ts](src/lib/refill-methods/chart.ts) に以下の関数を実装：

#### `fetchTracksFromChart(limit: number = 50, options?: { timeoutMs?: number; userAgent?: string }): Promise<Track[]>`

- Apple RSS Charts API を使用してチャート上位の楽曲を取得
- エンドポイント：`https://rss.applemarketingtools.com/api/v2/jp/music/most-played/${limit}/songs`
- エラーハンドリングとレート制限対応を含む
- タイムアウト：デフォルト 5000ms（AbortController 使用）

#### `fetchTracksFromChartWithRetry(limit: number = 50, maxRetries: number = 3, baseDelay: number = 1000, maxDelay: number = 30000, jitterFactor: number = 0.5): Promise<Track[]>`

- リトライ機能付きのチャート取得関数
- 指数バックオフ + ジッター方式

## 使用例

```typescript
import {
  getTracksFromPool,
  addTracksToPool,
  getPoolSize,
} from "@/lib/track-pool";
import { fetchTracksFromChart } from "@/lib/refill-methods/chart";

// プールサイズを確認
const size = await getPoolSize();
console.log(`Current pool size: ${size}`);

// チャートから楽曲を取得してプールに追加
const tracks = await fetchTracksFromChart(50);
await addTracksToPool(tracks, { method: "chart", weight: 1.0 });

// プールから楽曲を取得
const poolTracks = await getTracksFromPool(10);
```

## テスト

テストスクリプト: [src/tests/test-track-pool.ts](src/tests/test-track-pool.ts)

```bash
# テストの実行（要実装: ts-nodeの設定）
node --loader ts-node/esm src/tests/test-track-pool.ts
```

## 実装の詳細要件

1. **重複排除**: `track_id`を基準に`.upsert()`を使用し、`onConflict: 'track_id'`を指定
2. **サイズ上限管理**: `addTracksToPool()`実行後に必ず`trimPool()`を呼び出す
3. **エラーハンドリング**: すべての関数で適切なエラーハンドリングとログ出力を実施
4. **型安全性**: TypeScript の型定義を厳格に適用し、`Database`型を活用

## 注意事項

- `track_id`は BigInt ですが、TypeScript 型では`string`として扱います（桁あふれ対策）
- Apple RSS Charts API のレスポンス形式に注意し，適切に`Track`型にマッピングします
- Apple RSS API は `previewUrl` を提供しないため，`item.url`（ストアページ URL）を使用しています
- 環境変数が設定されていない場合のフォールバック処理を含めています
