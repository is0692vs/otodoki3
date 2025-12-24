import { test, expect } from '@playwright/test';
import { loginAsTestUser, logout } from './helpers/auth';

test.describe('認証フロー', () => {
    test.beforeEach(async ({ page }) => {
        // 各テストの前にログアウト状態にする
        await logout(page);
    });

    test('未認証ユーザーがホームにアクセスするとログイン画面にリダイレクトされる', async ({ page }) => {
        // ホーム画面にアクセスを試みる
        await page.goto('/');

        // ログイン画面にリダイレクトされることを確認
        await expect(page).toHaveURL(/\/login/);

        // ログインページの要素が表示されているか確認
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible();
    });

    test('ログインに成功するとホーム画面に遷移する', async ({ page }) => {
        // ログイン処理を実行
        await loginAsTestUser(page);

        // ホーム画面に遷移したことを確認
        await expect(page).toHaveURL('/');

        // ホーム画面の要素が表示されているか確認（例: カードスタック）
        const mainContent = page.locator('main');
        await expect(mainContent).toBeVisible();
    });

    test('無効な認証情報でログインに失敗する', async ({ page }) => {
        await page.goto('/login');

        // 無効な認証情報を入力
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');

        await emailInput.fill('invalid@example.com');
        await passwordInput.fill('wrongpassword');

        // ログインボタンをクリック
        const loginButton = page.locator('button[type="submit"]');
        await loginButton.click();

        // エラーメッセージが表示されるか、ログインページに留まることを確認
        await page.waitForTimeout(2000); // エラー表示を待機
        await expect(page).toHaveURL(/\/login/);
    });

    test('認証済みユーザーはログインページにアクセスしてもホームにリダイレクトされる', async ({ page }) => {
        // まずログイン
        await loginAsTestUser(page);

        // その後、ログインページに再度アクセスを試みる
        await page.goto('/login');

        // ホーム画面にリダイレクトされることを確認
        await expect(page).toHaveURL('/');
    });
});
