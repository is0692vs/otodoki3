"use client";

import { usePathname } from "next/navigation";

import { logout } from "@/lib/auth/logout";
import { NavItem } from "@/components/NavItem";
import { NAV_ITEMS } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-30 hidden w-64 border-r border-white/10 bg-black/20 backdrop-blur-xl md:block"
      aria-label="Sidebar"
    >
      <div className="flex h-full flex-col p-6">
        <div className="mb-8 px-2">
          <h1 className="bg-gradient-to-br from-white to-white/40 bg-clip-text text-2xl font-black tracking-tight text-transparent">
            otodoki3
          </h1>
        </div>
        <nav
          className="flex flex-1 flex-col gap-2"
          aria-label="Primary navigation"
        >
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
        </nav>
      </div>
    </aside>
  );
}
