"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface TrendChartProps {
  data: { month: string; amount: number }[];
  title: string;
  color?: string;
}

export function TrendChart({ data, title, color = "var(--accent)" }: TrendChartProps) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-secondary p-4">
      <h3 className="text-sm font-medium text-text-secondary mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border-default)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-tertiary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              color: "var(--text-primary)",
            }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`, "Amount"]}
          />
          <Bar dataKey="amount" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
