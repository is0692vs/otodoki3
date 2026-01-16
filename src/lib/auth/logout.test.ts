import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { logout } from './logout';

// Mock dependencies using vi.hoisted to avoid reference errors
const { mockSignOut } = vi.hoisted(() => {
  return { mockSignOut: vi.fn() };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

describe('logout', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    originalLocation = window.location;
    // Mock window.location
    // window.location is read-only in JSDOM, so we need to redefine it
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('サインアウトを実行し、ログインページにリダイレクトする', async () => {
    await logout();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/login');
  });
});
