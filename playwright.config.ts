import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// .env.test を読み込み
dotenv.config({ path: '.env.test' });

const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'TEST_USER_EMAIL',
    'TEST_USER_PASSWORD',
] as const;

const missingEnv = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    throw new Error(`Missing required env vars for Playwright tests: ${missingEnv.join(', ')}`);
}

const env = process.env as Record<string, string>;
const {
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
    ALLOWED_EMAILS,
} = env;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'html',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
        env: {
            NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY,
            TEST_USER_EMAIL,
            TEST_USER_PASSWORD,
            ALLOWED_EMAILS: ALLOWED_EMAILS ?? TEST_USER_EMAIL,
        },
    },
});
