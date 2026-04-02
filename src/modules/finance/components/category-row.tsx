import { ProgressBar } from "@/shared/components/progress-bar";
import { StatusBadge } from "@/shared/components/status-badge";
import { formatCurrency } from "@/shared/lib/utils";
import type { CategoryBudgetStatus } from "@/modules/finance/types";

interface CategoryRowProps {
  item: CategoryBudgetStatus;
}

export function CategoryRow({ item }: CategoryRowProps) {
  const { category, spent, budgeted, percentUsed, status } = item;

  return (
    <div className="flex items-center gap-4 py-3 px-2 border-b border-border-subtle last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-text-primary truncate">
            {category.name}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-sm text-text-secondary">
              {formatCurrency(spent)} / {formatCurrency(budgeted)}
            </span>
            <StatusBadge status={status} />
          </div>
        </div>
        <ProgressBar value={Math.min(percentUsed, 100)} status={status} />
      </div>
    </div>
  );
}
