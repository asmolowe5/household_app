"use client";

import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import type { PaceStatus } from "@/shared/lib/constants";

interface ProgressBarProps {
  value: number; // 0-100
  status: PaceStatus;
  className?: string;
}

const statusColors: Record<PaceStatus, string> = {
  green: "bg-status-green",
  yellow: "bg-status-yellow",
  orange: "bg-status-orange",
  red: "bg-status-red",
};

const trackColors: Record<PaceStatus, string> = {
  green: "bg-status-green-muted",
  yellow: "bg-status-yellow-muted",
  orange: "bg-status-orange-muted",
  red: "bg-status-red-muted",
};

export function ProgressBar({ value, status, className }: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className={cn("h-2 rounded-full overflow-hidden", trackColors[status], className)}
    >
      <motion.div
        className={cn("h-full rounded-full", statusColors[status])}
        initial={{ width: 0 }}
        animate={{ width: `${clampedValue}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
