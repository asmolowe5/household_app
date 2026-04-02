import { createClient } from "@/shared/lib/supabase/server";
import { TrendChart } from "@/modules/finance/components/trend-chart";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const supabase = await createClient();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split("T")[0];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("date, amount, transaction_type")
    .gte("date", startDate)
    .order("date");

  const monthlySpending: Record<string, number> = {};
  const monthlyIncome: Record<string, number> = {};

  for (const txn of transactions ?? []) {
    const month = txn.date.substring(0, 7);
    const label = new Date(txn.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" });
    const key = `${month}|${label}`;

    if (txn.transaction_type === "expense") {
      monthlySpending[key] = (monthlySpending[key] ?? 0) + Math.abs(txn.amount);
    } else if (txn.transaction_type === "income") {
      monthlyIncome[key] = (monthlyIncome[key] ?? 0) + Math.abs(txn.amount);
    }
  }

  const spendingData = Object.entries(monthlySpending)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({ month: key.split("|")[1], amount: Math.round(amount) }));

  const incomeData = Object.entries(monthlyIncome)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, amount]) => ({ month: key.split("|")[1], amount: Math.round(amount) }));

  return (
    <div className="max-w-3xl space-y-6">
      <TrendChart data={spendingData} title="Monthly Spending" color="var(--status-orange)" />
      <TrendChart data={incomeData} title="Monthly Income" color="var(--status-green)" />
    </div>
  );
}
