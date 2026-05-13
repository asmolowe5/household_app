"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => defaultValue,
  );
}

export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)", true);
}

export function useIsCompactDesktop(): boolean {
  const isBelowWide = !useMediaQuery("(min-width: 900px)", false);
  const isAtLeastTablet = useMediaQuery("(min-width: 768px)", false);

  return isBelowWide && isAtLeastTablet;
}
