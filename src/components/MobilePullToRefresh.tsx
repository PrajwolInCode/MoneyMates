import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Toast } from "./Toast";
import { useHousehold } from "../contexts/HouseholdContext";

function messageFromError(caught: unknown) {
  return caught instanceof Error ? caught.message : "Data could not be loaded.";
}

function isFormTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function MobilePullToRefresh() {
  const { refresh } = useHousehold();
  const startY = useRef<number | null>(null);
  const pullDistance = useRef(0);
  const tracking = useRef(false);
  const [visibleDistance, setVisibleDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toast && !error) return;
    const timeout = window.setTimeout(() => {
      setToast(null);
      setError(null);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [error, toast]);

  const runRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setToast(null);
    setError(null);
    try {
      await refresh({ throwOnError: true, clearNotifications: true });
      setToast("Data refreshed and notifications cleared");
    } catch (caught) {
      setError(messageFromError(caught));
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (window.innerWidth >= 768 || window.scrollY > 0 || refreshing || isFormTarget(event.target)) return;
      startY.current = event.touches[0]?.clientY ?? null;
      pullDistance.current = 0;
      tracking.current = startY.current !== null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking.current || startY.current === null || window.scrollY > 0) return;
      const nextY = event.touches[0]?.clientY ?? startY.current;
      const distance = Math.max(0, Math.min(120, nextY - startY.current));
      pullDistance.current = distance;
      setVisibleDistance(distance);
    };

    const handleTouchEnd = () => {
      const shouldRefresh = tracking.current && pullDistance.current >= 90;
      tracking.current = false;
      startY.current = null;
      pullDistance.current = 0;
      setVisibleDistance(0);
      if (shouldRefresh) void runRefresh();
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [refreshing, runRefresh]);

  const showIndicator = refreshing || visibleDistance > 24;

  return (
    <>
      {toast ? <Toast message={toast} /> : null}
      {error ? <Toast message={error} tone="error" /> : null}
      {showIndicator ? (
        <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-soft md:hidden">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {refreshing ? "Refreshing your household data..." : visibleDistance >= 90 ? "Release to refresh" : "Pull to refresh"}
        </div>
      ) : null}
    </>
  );
}
