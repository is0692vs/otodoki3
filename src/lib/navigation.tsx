import { Music, Library, LogOut, User } from "lucide-react";
import type { ReactNode } from "react";

export type NavItemSpec = {
  icon: ReactNode;
  label: string;
  href?: string;
  isLogout?: boolean;
};

export const NAV_ITEMS: NavItemSpec[] = [
  { icon: <Music className="h-5 w-5" />, label: "スワイプ", href: "/" },
  {
    icon: <Library className="h-5 w-5" />,
    label: "ライブラリ",
    href: "/playlists",
  },
  { icon: <LogOut className="h-5 w-5" />, label: "ログアウト", isLogout: true },
  { icon: <User className="h-5 w-5" />, label: "マイページ", href: "/profile" },
];
