import { createClient } from "@/shared/lib/supabase/server";
import { PlaidLinkButton } from "@/modules/finance/components/plaid-link-button";
import { formatCurrencyCents } from "@/shared/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountsSettingsPage() {
  const supabase = await createClient();

  const { data: plaidItems } = await supabase
    .from("plaid_items")
    .select("*, accounts:accounts(*)");

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">Connected Accounts</h2>
        <PlaidLinkButton />
      </div>

      {(plaidItems ?? []).length === 0 ? (
        <p className="text-sm text-text-tertiary">No accounts connected yet.</p>
      ) : (
        <div className="space-y-4">
          {(plaidItems ?? []).map((item: any) => (
            <div key={item.id} className="rounded-lg border border-border bg-bg-secondary p-4">
              <h3 className="text-sm font-medium text-text-primary mb-2">
                {item.institution_name}
              </h3>
              <div className="space-y-1">
                {(item.accounts ?? []).map((account: any) => (
                  <div key={account.id} className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{account.name}</span>
                    <span className="tabular-nums text-text-primary">
                      {account.current_balance !== null
                        ? formatCurrencyCents(account.current_balance)
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
