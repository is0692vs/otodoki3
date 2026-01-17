import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logout } from './logout';

// モックの作成
const signOutMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: signOutMock,
    },
  }),
}));

describe('logout', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    // window.location をモック化
    // JSDOM では window.location は読み取り専用なので削除して再定義する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = { href: '' };
  });

  afterEach(() => {
    // window.location を復元
    window.location = originalLocation;
  });

  it('サインアウトを実行し、ログインページへリダイレクトする', async () => {
    await logout();

    // signOut が呼ばれたことを確認
    expect(signOutMock).toHaveBeenCalledTimes(1);

    // リダイレクトを確認
    expect(window.location.href).toBe('/login');
  });
});
