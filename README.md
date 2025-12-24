This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase Authentication

The app now relies on Supabase Auth to protect the discovery experience and keep the beta invitation-only.

- `/login` renders a combined Google + email/password login form that issues OAuth redirects to `/auth/callback`.
- `/auth/callback` exchanges Supabase codes for sessions and redirects users back to the requested path.
- `/waitlist` shows a holding page for accounts that are not on the allowed-email list.
- `src/middleware.ts` uses `@supabase/ssr` to guard `/`, redirect unauthenticated users to `/login`, and send everyone without an allowed email to `/waitlist`.
- A logout button on the home screen links back to `/login` so testers can switch accounts.

Required environment variables for authentication:

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
ALLOWED_EMAILS=user@example.com
```

`ALLOWED_EMAILS` should be a comma-separated list of addresses allowed to sign in while the closed beta is running.

## テスト

このプロジェクトは Jest を使用してテストを実行します。

### テスト実行方法

```bash
# すべてのテストを実行
npm test

# カバレッジ付きで実行
npm run test:coverage

# ウォッチモードで実行
npm run test:watch
```

### 環境変数の設定

テストを実行するには、以下の環境変数が必要です：

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
TRACK_POOL_MAX_SIZE=10
```

詳細は [src/lib/**tests**/README.md](src/lib/__tests__/README.md) を参照してください。

### テストカバレッジ目標

- 全体: 80% 以上
- 重要な関数: 100%

現在のカバレッジ:

- `src/lib/refill-methods/chart.ts`: 93.47% (statements), 95.34% (lines)
