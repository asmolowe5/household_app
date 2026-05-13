"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState(defaultValue);

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
  return !useMediaQuery("(min-width: 768px)", true);
}

export function useIsCompactDesktop(): boolean {
  const isBelowWide = !useMediaQuery("(min-width: 900px)", false);
  const isAtLeastTablet = useMediaQuery("(min-width: 768px)", false);

  return isBelowWide && isAtLeastTablet;
}
