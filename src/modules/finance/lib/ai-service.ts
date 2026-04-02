import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/shared/lib/supabase/admin";
import { buildAiContext } from "./ai-context-builder";
import { AI_TOOLS } from "./ai-tools";
import { formatCurrency } from "@/shared/lib/utils";
import type { Category } from "@/modules/finance/types";

function getGenAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  switch (name) {
    case "get_category_spending": {
      const { data } = await admin
        .from("categories")
        .select("id, name, monthly_budget")
        .ilike("name", `%${args.category_name}%`)
        .limit(1)
        .single();
      if (!data) return `Category "${args.category_name}" not found.`;

      const { data: txns } = await admin
        .from("transactions")
        .select("amount")
        .eq("portal_category_id", data.id)
        .eq("transaction_type", "expense")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const spent = (txns ?? []).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      return `${data.name}: ${formatCurrency(spent)} spent of ${formatCurrency(data.monthly_budget)} budget. ${formatCurrency(data.monthly_budget - spent)} remaining.`;
    }

    case "get_merchant_spending": {
      const { data: txns } = await admin
        .from("transactions")
        .select("amount, merchant_name")
        .ilike("merchant_name", `%${args.merchant_name}%`)
        .eq("transaction_type", "expense")
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const total = (txns ?? []).reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      const count = txns?.length ?? 0;
      return `${args.merchant_name}: ${formatCurrency(total)} across ${count} transactions this month.`;
    }

    case "get_budget_summary": {
      const { data: categories } = await admin.from("categories").select("*").eq("is_active", true);
      const { data: transactions } = await admin
        .from("transactions")
        .select("*")
        .gte("date", monthStart)
        .lte("date", monthEnd);
      const { data: accounts } = await admin.from("accounts").select("*");

      const { calculateBudgetSummary } = await import("./budget-engine");
      const summary = calculateBudgetSummary(
        (categories ?? []) as Category[],
        transactions ?? [],
        accounts ?? [],
        now
      );

      return `Overall: ${formatCurrency(summary.totalSpent)} of ${formatCurrency(summary.totalBudgeted)} (${summary.overallStatus}). Daily allowance: ${formatCurrency(summary.dailyAllowance)}/day for ${summary.daysInMonth - summary.dayOfMonth} remaining days.`;
    }

    case "get_savings_balance": {
      const { data: accounts } = await admin.from("accounts").select("*");
      const savings = accounts?.find(
        (a: any) => a.subtype === "savings" || a.name?.toLowerCase().includes("savings")
      );
      return savings
        ? `Savings balance: ${formatCurrency(savings.current_balance ?? 0)}`
        : "No savings account connected.";
    }

    case "get_recent_transactions": {
      let query = admin
        .from("transactions")
        .select("date, amount, merchant_name, transaction_type")
        .order("date", { ascending: false })
        .limit(args.limit ?? 10);

      if (args.merchant_filter) {
        query = query.ilike("merchant_name", `%${args.merchant_filter}%`);
      }

      const { data: txns } = await query;
      return (txns ?? [])
        .map((t: any) => `${t.date} | ${t.merchant_name} | ${formatCurrency(Math.abs(t.amount))} (${t.transaction_type})`)
        .join("\n");
    }

    case "create_category": {
      const { error } = await admin.from("categories").insert({
        name: args.name,
        type: args.type,
        monthly_budget: args.monthly_budget,
        is_temporary: args.is_temporary ?? false,
      });
      return error ? `Error creating category: ${error.message}` : `Created category "${args.name}" with budget ${formatCurrency(args.monthly_budget)}.`;
    }

    case "recategorize_transaction": {
      const { data: cat } = await admin
        .from("categories")
        .select("id")
        .ilike("name", `%${args.category_name}%`)
        .limit(1)
        .single();
      if (!cat) return `Category "${args.category_name}" not found.`;

      await admin
        .from("transactions")
        .update({ portal_category_id: cat.id })
        .eq("id", args.transaction_id);

      if (args.create_rule) {
        const { data: txn } = await admin
          .from("transactions")
          .select("merchant_name")
          .eq("id", args.transaction_id)
          .single();
        if (txn?.merchant_name) {
          await admin.from("category_rules").insert({
            pattern: txn.merchant_name.toLowerCase(),
            category_id: cat.id,
            source: "ai",
          });
        }
      }
      return `Transaction recategorized to "${args.category_name}".`;
    }

    case "update_budget": {
      const { error } = await admin
        .from("categories")
        .update({ monthly_budget: args.new_budget })
        .ilike("name", `%${args.category_name}%`);
      return error ? `Error: ${error.message}` : `Updated "${args.category_name}" budget to ${formatCurrency(args.new_budget)}/month.`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

export async function chat(
  userId: string,
  message: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<string> {
  const systemPrompt = await buildAiContext(userId);

  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: message }] },
  ];

  const response = await getGenAI().models.generateContent({
    model: "gemini-2.0-flash",
    contents: messages,
    config: {
      systemInstruction: systemPrompt,
      tools: [{
        functionDeclarations: AI_TOOLS as any,
      }],
    },
  });

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  for (const part of parts) {
    if (part.functionCall?.name) {
      const toolResult = await executeTool(
        part.functionCall.name,
        part.functionCall.args as Record<string, any>
      );

      const followUp = await getGenAI().models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          ...messages,
          { role: "model" as const, parts: [{ functionCall: part.functionCall }] },
          { role: "user" as const, parts: [{ functionResponse: { name: part.functionCall.name, response: { result: toolResult } } }] },
        ],
        config: {
          systemInstruction: systemPrompt,
        },
      });

      return followUp.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't generate a response.";
    }
  }

  return parts[0]?.text ?? "I couldn't generate a response.";
}
