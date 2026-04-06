// src/modules/finance/components/review-badge.tsx
interface ReviewBadgeProps {
  count: number;
}

export function ReviewBadge({ count }: ReviewBadgeProps) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
      {count > 99 ? "99+" : count}
    </span>
  );
}
