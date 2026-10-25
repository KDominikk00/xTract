"use client";

import { useSyncExternalStore } from "react";
import { getWakeStatusServerSnapshot, getWakeStatusSnapshot, subscribeWakeStatus } from "@/lib/wakeStatus";

export default function WakingNotice() {
  const waking = useSyncExternalStore(subscribeWakeStatus, getWakeStatusSnapshot, getWakeStatusServerSnapshot);
  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-20 z-50 max-w-sm rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 text-sm text-zinc-200 shadow-lg backdrop-blur sm:bottom-6 sm:left-6 sm:right-auto"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500"
        />
        <p>
          <span className="font-semibold text-white">Sorry for the wait.</span> Our free server is waking up, so market
          data can take up to a minute to load. Thanks for your patience!
        </p>
      </div>
    </div>
  );
}
