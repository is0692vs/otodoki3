import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers/auth';

/**
 * チュートリアルカードをスキップして、実際のトラックカードを表示させる
 */
async function skipTutorialIfPresent(page: import('@playwright/test').Page) {
    // 最初のスワイプ可能な要素を取得
    const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
    await expect(topSwipeable).toBeVisible({ timeout: 10000 });

    const label = await topSwipeable.getAttribute('aria-label');
    if (label?.includes('チュートリアル')) {
        console.log('Tutorial card detected. Clicking Like to skip it.');
        await page.locator('button[aria-label="いいね"]').click();
        
        // チュートリアルでない次のカードが表示されるまで待機
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

        // スワイプ可能なカードが表示されることを確認
        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        await expect(topSwipeable).toBeVisible({ timeout: 10000 });

        // カードの内容が表示されているか確認
        const cardStack = page.locator('[data-testid="track-card-stack"]').or(page.locator('main'));
        await expect(cardStack).toBeVisible();
    });

    test('右スワイプ（Like）で次のカードが表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // チュートリアルをスキップして実トラックカードで検証
        await skipTutorialIfPresent(page);

        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';

        // いいねボタンをクリック
        await page.locator('button[aria-label="いいね"]').click();

        // 次のカードが表示されることを確認
        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toBe(firstTopLabel);
    });

    test('左スワイプ（Dislike）で次のカードが表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // チュートリアルをスキップして実トラックカードで検証
        await skipTutorialIfPresent(page);

        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';

        // よくないボタンをクリック
        await page.locator('button[aria-label="よくない"]').click();

        // 次のカードが表示されることを確認
        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toBe(firstTopLabel);
    });

    test('Likeボタンクリックで動作する', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await skipTutorialIfPresent(page);

        // Likeボタンを探す
        const likeButton = page.locator('button[aria-label="いいね"]');
        await expect(likeButton).toBeVisible();

        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';

        // ボタンをクリック
        await likeButton.click();

        // 次のカードが表示されることを確認
        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toBe(firstTopLabel);
    });

    test('Dislikeボタンクリックで動作する', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await skipTutorialIfPresent(page);

        // Dislikeボタンを探す
        const dislikeButton = page.locator('button[aria-label="よくない"]');
        await expect(dislikeButton).toBeVisible();

        const topSwipeable = page.locator('[aria-label$="をスワイプ"]').first();
        const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';

        // ボタンをクリック
        await dislikeButton.click();

        // 次のカードが表示されることを確認
        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toBe(firstTopLabel);
    });

    test('トラック情報が正しく表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await skipTutorialIfPresent(page);

        // カードを取得
        const cards = page.locator('[data-testid="track-card"]').or(page.locator('article, [role="article"]'));
        const firstCard = cards.first();

        await expect(firstCard).toBeVisible();

        // トラック名またはアーティスト名が表示されているか確認
        const hasText = await firstCard.textContent();
        expect(hasText).toBeTruthy();
        expect(hasText!.length).toBeGreaterThan(0);
    });
});
