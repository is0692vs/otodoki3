"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error";
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  type,
  isVisible,
  onClose,
  duration = 3000,
}: ToastProps) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onCloseRef.current();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  const Icon = type === "success" ? CheckCircle2 : XCircle;
  const bgColor = type === "success" ? "bg-green-500/90" : "bg-red-500/90";
  const iconColor = type === "success" ? "text-green-100" : "text-red-100";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            className={`${bgColor} flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-sm`}
            role="alert"
            aria-live="polite"
          >
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <p className="text-sm font-semibold text-white">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
