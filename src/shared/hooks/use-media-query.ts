"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    function handleChange(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return !useMediaQuery("(min-width: 768px)");
}

export function useIsCompactDesktop(): boolean {
  return !useMediaQuery("(min-width: 900px)") && useMediaQuery("(min-width: 768px)");
}
