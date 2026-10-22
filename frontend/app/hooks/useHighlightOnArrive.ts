"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Shared hook to scroll to a target element and apply a 3.5s highlight
 * with automatic timeout cleanup on unmount to prevent leaks.
 */
export function useHighlightOnArrive(durationMs: number = 3500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentHighlightedRef = useRef<HTMLElement | null>(null);

  const clearHighlight = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (currentHighlightedRef.current) {
      currentHighlightedRef.current.classList.remove("target-highlight");
      currentHighlightedRef.current = null;
    }
  }, []);

  const triggerHighlight = useCallback(
    (targetId: string) => {
      if (typeof window === "undefined" || !targetId) return;

      clearHighlight();

      const el = document.getElementById(targetId);
      if (!el) return;

      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("target-highlight");
      currentHighlightedRef.current = el;

      timeoutRef.current = setTimeout(() => {
        el.classList.remove("target-highlight");
        currentHighlightedRef.current = null;
        timeoutRef.current = null;
      }, durationMs);
    },
    [clearHighlight, durationMs]
  );

  // Check URL query parameters for ?highlight=<id> on mount or search changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const highlightId = urlParams.get("highlight");
      if (highlightId) {
        const timer = setTimeout(() => {
          triggerHighlight(highlightId);
        }, 150);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [triggerHighlight]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearHighlight();
    };
  }, [clearHighlight]);

  return { triggerHighlight, clearHighlight };
}
