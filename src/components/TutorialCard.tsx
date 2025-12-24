"use client";

export function TutorialCard() {
  return (
    <article
      className="relative h-full w-full overflow-hidden rounded-3xl bg-linear-to-br from-blue-50 to-indigo-100 text-foreground dark:from-blue-950 dark:to-indigo-900"
      aria-label="チュートリアルカード"
    >
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        {/* ロゴ / アプリ名 */}
        <div className="mb-8">
          <div className="text-4xl">🎵</div>
          <h2 className="mt-3 text-2xl font-bold">ディスカバリー</h2>
          <p className="mt-1 text-sm opacity-90">新しい音楽との出会い</p>
        </div>

        {/* スワイプガイド */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-2xl">👈</span>
            <div className="text-left">
              <p className="font-semibold">左スワイプ</p>
              <p className="text-sm opacity-90">スキップ</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-2xl">👉</span>
            <div className="text-left">
              <p className="font-semibold">右スワイプ</p>
              <p className="text-sm opacity-90">Like</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10">
          <p className="text-lg font-semibold">スワイプして始めよう！</p>
          <p className="mt-2 text-sm opacity-90">→ または ←</p>
        </div>
      </div>
    </article>
  );
}
