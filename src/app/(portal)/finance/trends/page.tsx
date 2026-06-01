import { getCategories, getMonthExpenses, buildCategorySpend, buildMonthSummary } from "@/modules/finance/queries";
import { TrendsClient } from "@/modules/finance/components/trends-client";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

  const [categories, txns] = await Promise.all([
    getCategories(),
    getMonthExpenses(startDate, endDate),
  ]);

  const categorySpend = buildCategorySpend(categories, txns);
  const monthSummary = buildMonthSummary(categories, txns);

  return (
    <TrendsClient
      categorySpend={categorySpend}
      summary={monthSummary}
      monthName={now.toLocaleString("default", { month: "long", year: "numeric" })}
    />
  );
}
