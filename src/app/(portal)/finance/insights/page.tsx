import { db } from "@/db";
import { financeInsights } from "@/db/schema";
import { desc } from "drizzle-orm";
import { InsightsHistoryClient } from "./insights-client";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const history = await db
    .select()
    .from(financeInsights)
    .orderBy(desc(financeInsights.createdAt));

  return <InsightsHistoryClient history={history} />;
}
