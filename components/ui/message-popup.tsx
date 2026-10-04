"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type MessagePopupType = "plain" | "error" | "success" | "warning" | "info";
export type MessagePopupPosition =
  | "top-left"
  | "top-middle"
  | "top-right"
  | "bottom-left"
  | "bottom-middle"
  | "bottom-right";

type MessagePopupProps = {
  message?: string | ReactNode;
  type?: MessagePopupType;
  position?: MessagePopupPosition;
  id?: string;
  className?: string;
  duration?: number;
  onDismiss: () => void;
};

const positionClasses: Record<MessagePopupPosition, string> = {
  "top-left": "left-4 top-4 sm:left-6 sm:top-6",
  "top-middle": "left-1/2 top-4 -translate-x-1/2 sm:top-6",
  "top-right": "right-4 top-4 sm:right-6 sm:top-6",
  "bottom-left": "bottom-4 left-4 sm:bottom-6 sm:left-6",
  "bottom-middle": "bottom-4 left-1/2 -translate-x-1/2 sm:bottom-6",
  "bottom-right": "bottom-4 right-4 sm:bottom-6 sm:right-6",
};

const typeClasses = "border-slate-200 bg-white text-slate-700 shadow-slate-200/70";
const fadeDuration = 200;

const indicatorClasses: Record<MessagePopupType, string> = {
  plain: "bg-slate-400",
  error: "bg-red-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

export default function MessagePopup({
  message,
  type = "plain",
  position = "bottom-middle",
  id,
  className = "",
  duration = 5000,
  onDismiss,
}: MessagePopupProps) {
  const dismissingRef = useRef(false);
  const [isDismissing, setIsDismissing] = useState(false);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setIsDismissing(true);
    window.setTimeout(() => {
      onDismiss();
      dismissingRef.current = false;
    }, fadeDuration);
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      const resetTimeoutId = window.setTimeout(() => {
        dismissingRef.current = false;
        setIsDismissing(false);
      }, 0);
      return () => window.clearTimeout(resetTimeoutId);
    }
    if (duration <= 0 || dismissingRef.current) return;
    const timeoutId = window.setTimeout(dismiss, duration);
    return () => window.clearTimeout(timeoutId);
  }, [dismiss, duration, isDismissing, message]);

  if (!message) return null;

  return (
    <div
      id={id}
      role={type === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`fixed z-50 flex w-[min(24rem,calc(100vw-2rem))] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg transition-opacity duration-200 ease-out ${isDismissing ? "pointer-events-none opacity-0" : "opacity-100"} ${positionClasses[position]} ${typeClasses} ${className}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${indicatorClasses[type]}`} />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={dismiss}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-current/60 transition hover:bg-black/5 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
