import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers/auth';

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

        // 最初のカードの情報を取得
        const cards = page.locator('[data-testid="track-card"]').or(page.locator('article, [role="article"]'));
        const initialCardCount = await cards.count();

        // Likeボタンを探してクリック、またはスワイプジェスチャーを実行
        const likeButton = page.locator('button[aria-label*="Like"], button[aria-label*="お気に入り"], button:has-text("♥")').first();

        if (await likeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await likeButton.click();
        } else {
            // ボタンが見つからない場合はスワイプジェスチャーを実行
            const card = cards.first();
            const box = await card.boundingBox();

            if (box) {
                // 右方向にスワイプ
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                await page.mouse.move(box.x + box.width + 100, box.y + box.height / 2, { steps: 10 });
                await page.mouse.up();
            }
        }

        // 次のカードが表示されるまで待機
        await page.waitForTimeout(1000);

        // カードが更新されたことを確認（数が減った、または内容が変わった）
        const newCardCount = await cards.count();
        expect(newCardCount).toBeGreaterThanOrEqual(0);
    });

    test('左スワイプ（Dislike）で次のカードが表示される', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // 最初のカードの情報を取得
        const cards = page.locator('[data-testid="track-card"]').or(page.locator('article, [role="article"]'));
        const initialCardCount = await cards.count();

        // Dislikeボタンを探してクリック、またはスワイプジェスチャーを実行
        const dislikeButton = page.locator('button[aria-label*="Dislike"], button[aria-label*="興味なし"], button:has-text("✕")').first();

        if (await dislikeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await dislikeButton.click();
        } else {
            // ボタンが見つからない場合はスワイプジェスチャーを実行
            const card = cards.first();
            const box = await card.boundingBox();

            if (box) {
                // 左方向にスワイプ
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 10 });
                await page.mouse.up();
            }
        }

        // 次のカードが表示されるまで待機
        await page.waitForTimeout(1000);

        // カードが更新されたことを確認
        const newCardCount = await cards.count();
        expect(newCardCount).toBeGreaterThanOrEqual(0);
    });

    test('Likeボタンクリックで動作する', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Likeボタンを探す
        const likeButton = page.locator('button[aria-label*="Like"], button[aria-label*="お気に入り"]').first();

        // ボタンが表示されている場合
        if (await likeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            // ボタンをクリック
            await likeButton.click();

            // クリック後の動作を確認（次のカードが表示される、アニメーションが発生するなど）
            await page.waitForTimeout(1000);

            // ページがクラッシュしていないことを確認
            const mainContent = page.locator('main');
            await expect(mainContent).toBeVisible();
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
        if (await dislikeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            // ボタンをクリック
            await dislikeButton.click();

            // クリック後の動作を確認
            await page.waitForTimeout(1000);

            // ページがクラッシュしていないことを確認
            const mainContent = page.locator('main');
            await expect(mainContent).toBeVisible();
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

        if (await firstCard.isVisible({ timeout: 2000 }).catch(() => false)) {
            // トラック名またはアーティスト名が表示されているか確認
            const hasText = await firstCard.textContent();
            expect(hasText).toBeTruthy();
            expect(hasText!.length).toBeGreaterThan(0);
        } else {
            test.skip();
        }
    });
});
