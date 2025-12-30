"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/logout";

export function LogoutButton() {
  return (
    <button
      onClick={() => void logout()}
      className="w-full flex items-center justify-center gap-2 p-4 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-xl transition-colors mt-8"
    >
      <LogOut className="w-5 h-5" />
      <span>ログアウト</span>
    </button>
  );
}
