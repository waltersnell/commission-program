"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const refreshIntervalMs = 30_000;

export function LiveDataRefresh() {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      if (now - lastRefreshRef.current < 1_000) {
        return;
      }
      lastRefreshRef.current = now;
      router.refresh();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }

    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const intervalId = window.setInterval(refresh, refreshIntervalMs);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [router]);

  return null;
}
