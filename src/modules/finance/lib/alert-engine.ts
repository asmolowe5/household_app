import { createAdminClient } from "@/shared/lib/supabase/admin";
import { calculateBudgetSummary } from "./budget-engine";
import { sendSms } from "./sms-service";
import { formatCurrency } from "@/shared/lib/utils";
import { ALERT_LIMITS } from "@/shared/lib/constants";
import type { Category, Transaction, Account, AlertRule, Profile } from "@/modules/finance/types";

export async function evaluateAlerts(): Promise<void> {
  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [categoriesRes, transactionsRes, accountsRes, profilesRes, rulesRes, logRes] = await Promise.all([
    admin.from("categories").select("*").eq("is_active", true),
    admin.from("transactions").select("*").gte("date", monthStart).lte("date", monthEnd),
    admin.from("accounts").select("*"),
    admin.from("profiles").select("*"),
    admin.from("alert_rules").select("*").eq("is_active", true),
    admin.from("alert_log").select("user_id, alert_rule_id, sent_at").gte("sent_at", `${today}T00:00:00`),
  ]);

  const categories = (categoriesRes.data ?? []) as Category[];
  const transactions = (transactionsRes.data ?? []) as Transaction[];
  const accounts = (accountsRes.data ?? []) as Account[];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const alertRules = (rulesRes.data ?? []) as AlertRule[];
  const todayLogs = logRes.data ?? [];

  const summary = calculateBudgetSummary(categories, transactions, accounts, now);

  for (const profile of profiles) {
    if (!profile.phone) continue;

    const todayCount = todayLogs.filter((l: any) => l.user_id === profile.id).length;
    if (todayCount >= ALERT_LIMITS.MAX_PER_PERSON_PER_DAY) continue;

    for (const catStatus of summary.categories) {
      const alreadyAlerted = todayLogs.some(
        (l: any) => l.user_id === profile.id && l.alert_rule_id === `pace-${catStatus.category.id}`
      );
      if (alreadyAlerted) continue;

      let message: string | null = null;

      if (catStatus.status === "red") {
        message = `🔴 Budget exceeded: ${catStatus.category.name} is at ${formatCurrency(catStatus.spent)} of ${formatCurrency(catStatus.budgeted)}. Consider pausing spending in this category for the rest of the month.`;
      } else if (catStatus.status === "orange") {
        const projected = Math.round(catStatus.projectedMonthEnd);
        message = `🟠 ${catStatus.category.name} is at ${formatCurrency(catStatus.spent)} of ${formatCurrency(catStatus.budgeted)} — but you're only ${summary.dayOfMonth} days in. At this rate you'll hit ${formatCurrency(projected)} by month end.`;
      }

      if (message) {
        await sendSms(profile.phone, message);
        await admin.from("alert_log").insert({
          alert_rule_id: `pace-${catStatus.category.id}`,
          user_id: profile.id,
          message_sent: message,
          channel: "sms",
        });
      }
    }

    const userRules = alertRules.filter((r) => r.user_id === profile.id);
    for (const rule of userRules) {
      const alreadyAlerted = todayLogs.some(
        (l: any) => l.user_id === profile.id && l.alert_rule_id === rule.id
      );
      if (alreadyAlerted) continue;

      if (rule.trigger_type === "merchant") {
        const merchant = (rule.trigger_params as any).merchant_name;
        const recentMerchantTxns = transactions.filter(
          (t) => t.merchant_name?.toLowerCase().includes(merchant?.toLowerCase())
        );
        if (recentMerchantTxns.length > 0) {
          const latest = recentMerchantTxns[recentMerchantTxns.length - 1];
          const catSpent = summary.categories.find(
            (c) => c.category.id === latest.portal_category_id
          );
          const msg = `${latest.merchant_name}: ${formatCurrency(Math.abs(latest.amount))}. ${catSpent ? `${catSpent.category.name} budget: ${formatCurrency(catSpent.spent)} of ${formatCurrency(catSpent.budgeted)} used.` : ""}`;

          await sendSms(profile.phone, msg);
          await admin.from("alert_log").insert({
            alert_rule_id: rule.id,
            user_id: profile.id,
            message_sent: msg,
            channel: "sms",
          });
        }
      }
    }
  }
}
