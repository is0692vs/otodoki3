"use client";

import { usePathname } from "next/navigation";

import { logout } from "@/lib/auth/logout";
import { NavItem } from "@/components/NavItem";
import { NAV_ITEMS } from "@/lib/navigation";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-40 glass rounded-2xl border border-white/10 shadow-2xl md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Bottom navigation"
    >
      <div className="mx-auto grid max-w-md grid-cols-4 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          if (item.isLogout) {
            return (
              <NavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                isActive={false}
                onClick={() => void logout()}
              />
            );
          }

          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href ?? "") ?? false;

          return (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              href={item.href as string}
              isActive={isActive}
            />
          );
        })}
      </div>
    </nav>
  );
}
