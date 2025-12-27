import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers/auth';

async function ensureTopIsTrackCard(page: import('@playwright/test').Page) {
    const topSwipeable = page.locator('[aria-label$="をスワイプ"]:not([aria-hidden="true"])').first();
    await expect(topSwipeable).toBeVisible();

    const label = await topSwipeable.getAttribute('aria-label');
    if (label?.includes('チュートリアル')) {
        // チュートリアルカードはネットワーク不要なので、確実なボタンクリックで除去
        await page.locator('button[aria-label="いいね"]').click();
        await expect.poll(async () => {
            const next = await page.locator('[aria-label$="をスワイプ"]:not([aria-hidden="true"])').first().getAttribute('aria-label');
            return next ?? '';
        }, { timeout: 5000 }).not.toContain('チュートリアル');
    }
}

/**
 * スワイプアクション（like/dislike）のテスト共通処理
 */
async function testSwipeAction(
    page: import('@playwright/test').Page,
    buttonLabel: string,
    apiEndpoint: string
) {
    // コンソールログを監視
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('[API]') || msg.text().includes('[Rollback]') || msg.text().includes('[swipeTop]')) {
            console.log(`Browser console: ${msg.text()}`);
        }
    });

    // 先頭がチュートリアルなら除去して、実トラックカードで検証する
    await ensureTopIsTrackCard(page);

    const topSwipeable = page.locator('[aria-label$="をスワイプ"]:not([aria-hidden="true"])').first();
    const firstTopLabel = (await topSwipeable.getAttribute('aria-label')) ?? '';
    console.log('First card:', firstTopLabel);

    // APIリクエストを監視（タイムアウトを長めに設定）
    const apiPromise = page.waitForResponse(
        response => response.url().includes(apiEndpoint) && response.request().method() === 'POST',
        { timeout: 15000 }
    ).catch(err => {
        console.log('API request not captured:', err.message);
        return null;
    });

    // UI実装に合わせて確実にボタンをクリック
    await page.locator(`button[aria-label="${buttonLabel}"]`).click();
    console.log(`Clicked ${buttonLabel} button`);

    // スワイプアニメーションが完了するまで待つ (200ms animation + 200ms buffer)
    await page.waitForTimeout(400);

    // APIレスポンスを待つ
    const response = await apiPromise;
    if (response) {
        const responseBody = await response.json().catch(() => ({ error: 'Failed to parse JSON' }));
        console.log('API Response:', response.status(), responseBody);

        // APIが成功した場合のみ、次のカードが表示されることを期待
        if (response.status() === 200) {
            // exitアニメーションが完了し、新しいカードが表示されていることを確認
            await expect.poll(async () => {
                const next = await page.locator('[aria-label$="をスワイプ"]:not([aria-hidden="true"])').first().getAttribute('aria-label');
                console.log('Current card:', next);
                return next ?? '';
            }, { timeout: 3000, intervals: [200] }).not.toBe(firstTopLabel);
        } else {
            throw new Error(`API call failed with status ${response.status()}`);
        }
    } else {
        throw new Error('No API response captured - API may not have been called');
    }
}

test.describe('ディスカバリー画面', () => {
    test.beforeEach(async ({ page }) => {
        // 認証済み状態でテストを開始
        await setupAuthenticatedSession(page);
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
        await testSwipeAction(page, 'いいね', '/api/tracks/like');
    });

    test('左スワイプ（Dislike）で次のカードが表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await testSwipeAction(page, 'よくない', '/api/tracks/dislike');
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
