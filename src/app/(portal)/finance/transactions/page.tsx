import { createClient } from "@/shared/lib/supabase/server";
import { TransactionList } from "@/modules/finance/components/transaction-list";
import type { Transaction } from "@/modules/finance/types";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("transactions")
    .select("*, category:categories(*)")
    .order("date", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-3xl">
      <TransactionList transactions={(data ?? []) as Transaction[]} />
    </div>
  );
}
