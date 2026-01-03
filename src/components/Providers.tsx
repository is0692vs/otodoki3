"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { ToastProvider } from "./ToastProvider";
import { ThemeProvider } from "next-themes";

/**
 * アプリケーション全体に共通のコンテキストと設定を提供するプロバイダーツリーをレンダーする。
 *
 * @param children - プロバイダーでラップする子要素（アプリケーションの UI）。
 * @returns QueryClient、Theme、Toast の各プロバイダーでラップされた子要素
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5分間はキャッシュを新鮮とみなす
            gcTime: 30 * 60 * 1000, // 30分間キャッシュを保持
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}