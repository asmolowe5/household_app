import { createClient } from "@/shared/lib/supabase/server";
import { getAccounts, getReviewCount } from "@/modules/finance/queries";
import type {
  Account,
  Transaction,
} from "@/modules/finance/types";

export async function getFinanceAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  return getAccounts(supabase);
}

export async function getFinanceTransactions(limit = 15): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(limit);
  return (data ?? []) as Transaction[];
}

export async function getFinanceReviewCount(): Promise<number> {
  const supabase = await createClient();
  return getReviewCount(supabase);
}
