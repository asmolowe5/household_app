import { NextResponse } from "next/server";
import { getCurrentUser } from "@/shared/lib/auth/session";
import { db } from "@/db";
import { accounts, transactions, categories, plaidItems, financeInsights } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI Categorization / Analysis skipped: GEMINI_API_KEY is not configured." },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch accounts (visible only)
    const userAccounts = await db
      .select({
        name: accounts.name,
        customName: accounts.customName,
        type: accounts.type,
        subtype: accounts.subtype,
        currentBalance: accounts.currentBalance,
        institutionName: plaidItems.institutionName,
      })
      .from(accounts)
      .leftJoin(plaidItems, eq(accounts.plaidItemId, plaidItems.id))
      .where(eq(accounts.isVisible, true));

    // 2. Fetch active categories
    const userCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        monthlyBudget: categories.monthlyBudget,
      })
      .from(categories)
      .where(eq(categories.isActive, true));

    // 3. Fetch transactions from the last 30 days for visible accounts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDateStr = thirtyDaysAgo.toISOString().split("T")[0];

    const userTransactions = await db
      .select({
        date: transactions.date,
        amount: transactions.amount,
        merchantName: transactions.merchantName,
        transactionType: transactions.transactionType,
        categoryName: categories.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.portalCategoryId, categories.id))
      .where(
        and(
          eq(accounts.isVisible, true),
          gte(transactions.date, startDateStr)
        )
      );

    if (userAccounts.length === 0) {
      return NextResponse.json(
        { error: "No connected accounts found to analyze. Connect Plaid first." },
        { status: 400 }
      );
    }

    // 4. Format prompt
    const accountsSummary = userAccounts
      .map(
        (a) =>
          `- ${a.customName ?? a.name} (${a.institutionName ?? "Unknown"}): $${a.currentBalance ?? 0} [${
            a.subtype ?? a.type
          }]`
      )
      .join("\n");

    const categoriesSummary = userCategories
      .map((c) => `- ${c.name} (Budget: $${c.monthlyBudget ?? 0})`)
      .join("\n");

    const recentTxnsList = userTransactions
      .slice(0, 100)
      .map(
        (t) =>
          `- ${t.date} | ${t.merchantName ?? "Unknown"} | $${t.amount} | Type: ${
            t.transactionType
          } | Category: ${t.categoryName ?? "Uncategorized"}`
      )
      .join("\n");

    const prompt = `You are a professional financial advisor analyzing a household's financial data for the last 30 days.
Analyze the provided accounts, budgets, and transactions, and write a detailed, highly professional financial report.

Here is the data:
### Connected Accounts:
${accountsSummary || "No connected accounts"}

### Budget Categories:
${categoriesSummary || "No budget categories defined"}

### Recent Transactions (Up to 100):
${recentTxnsList || "No recent transactions found"}

Please structure your report in markdown format:
1. **Executive Summary**: A brief, high-level overview of the household's current financial health, net worth snapshot (cash vs debt), and overall status.
2. **Top Spending Categories**: Identify which categories represent the highest expenditure. Compare this spending to their set monthly budgets if applicable.
3. **Unusual Spikes & Insights**: Call out any double-charges, sudden increases in regular expenses, high-cost single items, or anomalies.
4. **Actionable Savings Recommendations**: Provide 3-4 specific, actionable tips to optimize household cash flow, cut unnecessary subscriptions, or reduce spending.

Make the response engaging, clear, and extremely useful for a husband and wife reviewing their household finances. Avoid generic advice; tailor it directly to the patterns you see in the transaction list and balances. Do not mention Plaid internal technical details.

Return your response as a JSON object with:
{
  "title": "A descriptive, interesting title for this report (e.g., 'May 2026 Wealth & Cash Flow Insights')",
  "content": "The full report formatted in beautiful markdown"
}`;

    // 5. Query Gemini
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI returned empty response");
    }

    const result = JSON.parse(text);
    const title = result.title ?? `AI Financial Report - ${new Date().toLocaleDateString()}`;
    const content = result.content ?? "No content generated";

    // 6. Save insight to database
    const [insight] = await db
      .insert(financeInsights)
      .values({ title, content })
      .returning();

    return NextResponse.json({ success: true, insight });
  } catch (error) {
    console.error("AI Insight Generation Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
