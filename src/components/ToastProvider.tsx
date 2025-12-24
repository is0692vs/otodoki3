"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

type Toast = {
  id: string;
  type: "success" | "error" | "info";
  message: string;
};

const ToastContext = createContext<{
  push: (toast: Omit<Toast, "id">, ttl?: number) => string;
  dismiss: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timerId = timerRefs.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timerRefs.current.delete(id);
    }
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">, ttl = 3000) => {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const toast: Toast = { id, ...t };
      setToasts((s) => [toast, ...s]);

      if (ttl > 0) {
        const timerId = setTimeout(() => {
          dismiss(id);
        }, ttl);
        timerRefs.current.set(id, timerId);
      }
      return id;
    },
    [dismiss]
  );

  // クリーンアップ
  useEffect(() => {
    const currentTimers = timerRefs.current;
    return () => {
      currentTimers.forEach((timerId) => clearTimeout(timerId));
      currentTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex w-auto flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-xs rounded-md px-4 py-2 text-sm shadow-lg text-white ${
              t.type === "success"
                ? "bg-green-600"
                : t.type === "error"
                ? "bg-red-600"
                : "bg-black/80"
            }`}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
