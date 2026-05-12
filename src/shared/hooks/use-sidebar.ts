"use client";

import { useState, useCallback, useEffect } from "react";
import { useIsCompactDesktop } from "./use-media-query";

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED_WIDTH = 64;

export function useSidebar() {
  const isCompact = useIsCompactDesktop();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setIsCollapsed(isCompact);
  }, [isCompact]);

  const toggle = useCallback(() => setIsCollapsed((prev) => !prev), []);

  return {
    isCollapsed,
    toggle,
    width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    SIDEBAR_WIDTH,
    SIDEBAR_COLLAPSED_WIDTH,
  };
}
