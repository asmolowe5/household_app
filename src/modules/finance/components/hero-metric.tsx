"use client";

import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";
import { formatCurrency } from "@/shared/lib/utils";
import { ProgressBar } from "@/shared/components/progress-bar";
import type { BudgetSummary } from "@/modules/finance/types";

interface HeroMetricProps {
  summary: BudgetSummary;
}

const statusBgColors = {
  green: "bg-status-green-muted",
  yellow: "bg-status-yellow-muted",
  orange: "bg-status-orange-muted",
  red: "bg-status-red-muted",
};

export function HeroMetric({ summary }: HeroMetricProps) {
  const { totalSpent, totalBudgeted, overallStatus, dayOfMonth, daysInMonth, dailyAllowance, savingsBalance } = summary;

  return (
    <div className={cn("rounded-lg p-6 mb-6", statusBgColors[overallStatus])}>
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className="tabular-nums text-3xl font-semibold text-text-primary">
            {formatCurrency(totalSpent)}
          </span>
          <span className="text-text-secondary text-lg ml-2">
            of {formatCurrency(totalBudgeted)}
          </span>
        </div>
        <span className="text-sm text-text-tertiary">
          Day {dayOfMonth} of {daysInMonth}
        </span>
      </div>

      <ProgressBar
        value={Math.min((totalSpent / totalBudgeted) * 100, 100)}
        status={overallStatus}
        className="mb-3"
      />

      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">
          {formatCurrency(dailyAllowance)}/day remaining
        </span>
        {savingsBalance !== null && (
          <span className="text-text-tertiary">
            Savings: {formatCurrency(savingsBalance)}
          </span>
        )}
      </div>
    </div>
  );
}
