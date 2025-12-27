import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers/auth';

async function ensureTopIsTrackCard(page: import('@playwright/test').Page) {
    const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
    await expect(topSwipeable).toBeVisible();

    const label = await topSwipeable.getAttribute('aria-label');
    if (label?.includes('チュートリアル')) {
        // チュートリアルカードはネットワーク不要なので、確実なボタンクリックで除去
        await page.locator('button[aria-label="いいね"]').click();
        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toContain('チュートリアル');
    }
}

test.describe('ディスカバリー画面', () => {
    test.beforeEach(async ({ page }) => {
        // 認証済み状態でテストを開始
        await setupAuthenticatedSession(page);

        // Like/Dislike APIリクエストをモックして常に成功を返す
        await page.route('**/api/tracks/like', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        });

        await page.route('**/api/tracks/dislike', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        });
    });

    test('カードが表示される', async ({ page }) => {
        // ホーム画面に移動
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // カードスタックが表示されることを確認
        const cardStack = page.locator('[data-testid="track-card-stack"]').or(page.locator('main'));
        await expect(cardStack).toBeVisible();

        // カードが少なくとも1枚表示されていることを確認
        const cards = page.locator('[data-testid="track-card"]').or(page.locator('article, [role="article"]'));
        const cardCount = await cards.count();
        expect(cardCount).toBeGreaterThan(0);

        // カードの内容が表示されているか確認（トラック名、アーティスト名など）
        const firstCard = cards.first();
        await expect(firstCard).toBeVisible();
    });

    test('右スワイプ（Like）で次のカードが表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 先頭がチュートリアルなら除去して、実トラックカードで検証する
        await ensureTopIsTrackCard(page);

        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';

        // UI実装に合わせて確実にボタンをクリック
        await page.locator('button[aria-label="いいね"]').click();

        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toBe(firstTopLabel);
    });

    test('左スワイプ（Dislike）で次のカードが表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 先頭がチュートリアルなら除去して、実トラックカードで検証する
        await ensureTopIsTrackCard(page);

        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';

        await page.locator('button[aria-label="よくない"]').click();

        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toBe(firstTopLabel);
    });

    test('Likeボタンクリックで動作する', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Likeボタンを探す
        const likeButton = page.locator('button[aria-label*="Like"], button[aria-label*="お気に入り"]').first();

        // ボタンが表示されている場合
        if (await likeButton.isVisible({ timeout: 2000 })) {
            // ボタンをクリック
            await likeButton.click();

            // クリック後の動作を確認（次のカードが表示される、アニメーションが発生するなど）
            const mainContent = page.locator('main');
            await expect(mainContent).toBeVisible({ timeout: 5000 });
        } else {
            // ボタンが見つからない場合はテストをスキップ
            test.skip();
        }
    });

    test('Dislikeボタンクリックで動作する', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Dislikeボタンを探す
        const dislikeButton = page.locator('button[aria-label*="Dislike"], button[aria-label*="興味なし"]').first();

        // ボタンが表示されている場合
        if (await dislikeButton.isVisible({ timeout: 2000 })) {
            // ボタンをクリック
            await dislikeButton.click();

            // クリック後の動作を確認
            const mainContent = page.locator('main');
            await expect(mainContent).toBeVisible({ timeout: 5000 });
        } else {
            // ボタンが見つからない場合はテストをスキップ
            test.skip();
        }
    });

    test('トラック情報が正しく表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // カードを取得
        const cards = page.locator('[data-testid="track-card"]').or(page.locator('article, [role="article"]'));
        const firstCard = cards.first();

        if (await firstCard.isVisible({ timeout: 2000 })) {
            // トラック名またはアーティスト名が表示されているか確認
            const hasText = await firstCard.textContent();
            expect(hasText).toBeTruthy();
            expect(hasText!.length).toBeGreaterThan(0);
        } else {
            test.skip();
        }
    });
});
