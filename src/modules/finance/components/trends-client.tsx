"use client";

import { useEffect, useState } from "react";
import type { CategorySpend, MonthSummary } from "@/modules/finance/types";
import { formatCurrencyPrecise } from "@/shared/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Target, AlertCircle } from "lucide-react";

interface TrendsClientProps {
  categorySpend: CategorySpend[];
  summary: MonthSummary;
  monthName: string;
}

export function TrendsClient({
  categorySpend,
  summary,
  monthName,
}: TrendsClientProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter out categories that have zero budget AND zero spend to keep the chart clean
  const chartData = categorySpend
    .filter((c) => c.monthly_budget > 0 || c.total_spent > 0)
    .map((c) => ({
      name: c.name,
      Spent: Math.round(c.total_spent),
      Budget: Math.round(c.monthly_budget),
    }));

  const percentSpent = summary.total_budget > 0
    ? (summary.total_spent / summary.total_budget) * 100
    : 0;

  const pacePercent = (summary.days_elapsed / summary.days_in_month) * 100;
  const isOverPace = percentSpent > pacePercent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          Spending & Budget Trends
        </h1>
        <p className="text-xs text-text-tertiary mt-1">
          Analysis for {monthName}
        </p>
      </div>

      {/* Month Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Spent */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Total Spent</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-red/10 text-status-red">
              <ArrowDownRight size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(summary.total_spent)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-text-tertiary">
            <span>Expenses this month</span>
          </div>
        </div>

        {/* Budget */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Total Budget Limit</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-muted text-accent">
              <Target size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(summary.total_budget)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-text-tertiary">
            <span>Combined categories</span>
          </div>
        </div>

        {/* Income */}
        <div className="rounded-2xl border border-border-default bg-bg-secondary p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary">Total Income</p>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-status-green/10 text-status-green">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary tabular-nums">
            {formatCurrencyPrecise(summary.total_income)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-text-tertiary">
            <span>Deposits & incoming transfers</span>
          </div>
        </div>
      </div>

      {/* Progress & Pace Gauge */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-6">
        <h2 className="text-sm font-semibold text-text-primary">Monthly Budget Progress</h2>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs font-medium text-text-secondary">
            <span>
              {percentSpent.toFixed(0)}% of limit reached ({formatCurrencyPrecise(summary.total_spent)} of {formatCurrencyPrecise(summary.total_budget)})
            </span>
            <span>
              Day {summary.days_elapsed} of {summary.days_in_month} ({pacePercent.toFixed(0)}% of month)
            </span>
          </div>
          <div className="relative h-2.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
            {/* Monthly Pace Marker Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-text-tertiary z-10"
              style={{ left: `${pacePercent}%` }}
              title="Current time pace marker"
            />
            {/* Spent progress bar */}
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                summary.total_spent > summary.total_budget
                  ? "bg-status-red"
                  : isOverPace
                  ? "bg-accent"
                  : "bg-status-green"
              }`}
              style={{ width: `${Math.min(percentSpent, 100)}%` }}
            />
          </div>
          {summary.total_budget > 0 && (
            <div className="mt-3 flex items-start gap-2 text-xs text-text-tertiary">
              <AlertCircle size={14} className={isOverPace ? "text-accent" : "text-text-tertiary"} />
              <span>
                {summary.total_spent > summary.total_budget ? (
                  <strong className="text-status-red">Warning: Over budget limit!</strong>
                ) : isOverPace ? (
                  <span className="text-accent">Heads up: Spending is out-pacing the elapsed time of the month.</span>
                ) : (
                  <span className="text-status-green">Nice! Spending is within limits and tracking on-pace.</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Recharts chart */}
      <div className="rounded-2xl border border-border-default bg-bg-secondary p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-6">Spending vs. Budget by Category</h2>
        <div className="h-96 w-full">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#22252a" />
                <XAxis type="number" stroke="#8892b0" fontSize={11} tickFormatter={(val) => `$${val}`} />
                <YAxis dataKey="name" type="category" stroke="#8892b0" fontSize={11} width={100} />
                <Tooltip
                  cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                  contentStyle={{
                    backgroundColor: "#17181c",
                    borderColor: "#2a2d35",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`$${value}`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#8892b0" }} />
                <Bar dataKey="Spent" fill="#4ade80" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Budget" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-text-tertiary">
              Loading chart...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
