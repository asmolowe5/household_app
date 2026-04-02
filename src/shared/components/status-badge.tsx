import { cn } from "@/shared/lib/utils";
import type { PaceStatus } from "@/shared/lib/constants";

interface StatusBadgeProps {
  status: PaceStatus;
  label?: string;
}

const badgeStyles: Record<PaceStatus, string> = {
  green: "bg-status-green-muted text-status-green",
  yellow: "bg-status-yellow-muted text-status-yellow",
  orange: "bg-status-orange-muted text-status-orange",
  red: "bg-status-red-muted text-status-red",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const displayLabel = label ?? (status === "green" ? "On track" : status === "yellow" ? "Watch" : status === "orange" ? "Ahead" : "Over");

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium",
        badgeStyles[status]
      )}
    >
      {displayLabel}
    </span>
  );
}
