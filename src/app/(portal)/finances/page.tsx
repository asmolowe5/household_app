import { createClient } from "@/shared/lib/supabase/server";
import { formatCurrency, formatCurrencyPrecise, formatDate } from "@/shared/lib/utils";
import {
  getAccounts,
  getRecentTransactions,
  getCategories,
  getMonthExpenses,
  buildCategorySpend,
  buildMonthSummary,
  getReviewCount,
} from "@/modules/finance/queries";
import type { Account, MonthSummary, CategorySpend } from "@/modules/finance/types";
import { FinancesEmptyState } from "@/modules/finance/components/empty-state";
import { PlaidLinkButton } from "@/modules/finance/components/plaid-link-button";
import { TransactionListClient } from "@/modules/finance/components/finances-client";
import {
  UtensilsCrossed,
  ShoppingCart,
  ShoppingBag,
  Car,
  Film,
  Home,
  User,
  Building,
  Zap,
  Shield,
  Repeat,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  "utensils-crossed": UtensilsCrossed,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  car: Car,
  film: Film,
  home: Home,
  user: User,
  building: Building,
  zap: Zap,
  shield: Shield,
  repeat: Repeat,
};

function getIcon(name: string | null): LucideIcon {
  if (!name) return HelpCircle;
  return iconMap[name] ?? HelpCircle;
}

export default async function FinancesPage() {
  const supabase = await createClient();

  const accounts = await getAccounts(supabase);

  if (accounts.length === 0) {
    return <FinancesEmptyState />;
  }

  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const endDate = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, "0")}-${String(endOfMonth.getDate()).padStart(2, "0")}`;

  const [recentTransactions, categories, monthTransactions, reviewCount] =
    await Promise.all([
      getRecentTransactions(supabase),
      getCategories(supabase),
      getMonthExpenses(supabase, startDate, endDate),
      getReviewCount(supabase),
    ]);

  const categorySpend = buildCategorySpend(categories, monthTransactions);
  const summary = buildMonthSummary(categories, monthTransactions);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      <HeroSpend summary={summary} monthLabel={monthLabel} />
      <CategoryBreakdown categories={categorySpend} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <TransactionListClient
          transactions={recentTransactions}
          categories={categories}
          reviewCount={reviewCount}
        />
        <AccountSummary accounts={accounts} />
      </div>
    </div>
  );
}

/* ---------- Hero Spend ---------- */

function HeroSpend({
  summary,
  monthLabel,
}: {
  summary: MonthSummary;
  monthLabel: string;
}) {
  const hasBudget = summary.total_budget > 0;
  const spendPercent = hasBudget
    ? (summary.total_spent / summary.total_budget) * 100
    : 0;
  const pacePercent = (summary.days_elapsed / summary.days_in_month) * 100;
  const isAhead = spendPercent > pacePercent + 5;
  const isOver = spendPercent > 100;

  return (
    <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
      <p className="text-xs font-medium text-text-tertiary">{monthLabel}</p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-bold tracking-tight text-text-primary">
          {formatCurrency(summary.total_spent)}
        </span>
        {hasBudget && (
          <span className="text-sm text-text-tertiary">
            of {formatCurrency(summary.total_budget)} budget
          </span>
        )}
      </div>

      {hasBudget && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className={`h-full rounded-full transition-all ${
                isOver ? "bg-status-red" : "bg-accent"
              }`}
              style={{ width: `${Math.min(100, spendPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isOver
                  ? "bg-status-red"
                  : isAhead
                    ? "bg-status-red"
                    : "bg-status-green"
              }`}
            />
            <span className="text-xs text-text-secondary">
              {isOver
                ? "Over budget"
                : isAhead
                  ? "Ahead of pace"
                  : "On track"}
              {" \u2014 "}
              {Math.round(pacePercent)}% of month elapsed
            </span>
          </div>
        </div>
      )}

      {!hasBudget && (
        <p className="mt-3 text-xs text-text-tertiary">
          No budget set for this month
        </p>
      )}

      {summary.total_income > 0 && (
        <p className="mt-3 text-xs text-text-secondary">
          +{formatCurrency(summary.total_income)} income this month
        </p>
      )}
    </div>
  );
}

/* ---------- Category Breakdown ---------- */

function CategoryBreakdown({ categories }: { categories: CategorySpend[] }) {
  const discretionary = categories.filter((c) => c.type === "discretionary");
  const fixed = categories.filter((c) => c.type === "fixed");
  const hasAnySpend = categories.some((c) => c.total_spent > 0);

  return (
    <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
      <h2 className="text-sm font-semibold text-text-primary">
        Budget by Category
      </h2>

      {!hasAnySpend && categories.length > 0 && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-text-tertiary">No spending this month</p>
        </div>
      )}

      {categories.length === 0 && (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-text-tertiary">
            No categories configured
          </p>
        </div>
      )}

      {hasAnySpend && (
        <div className="mt-5 space-y-6">
          {discretionary.length > 0 && (
            <CategoryGroup label="Discretionary" items={discretionary} />
          )}
          {fixed.length > 0 && (
            <CategoryGroup label="Fixed" items={fixed} />
          )}
        </div>
      )}
    </div>
  );
}

function CategoryGroup({
  label,
  items,
}: {
  label: string;
  items: CategorySpend[];
}) {
  const active = items.filter(
    (c) => c.total_spent > 0 || c.monthly_budget > 0,
  );
  if (active.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <div className="space-y-3">
        {active.map((cat) => {
          const Icon = getIcon(cat.icon);
          const percent =
            cat.monthly_budget > 0
              ? (cat.total_spent / cat.monthly_budget) * 100
              : 0;
          const isOver = percent > 100;

          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Icon size={15} className="shrink-0 text-text-tertiary" />
                  <span className="text-[13px] font-medium text-text-primary">
                    {cat.name}
                  </span>
                </div>
                <span className="text-[13px] tabular-nums text-text-secondary">
                  {formatCurrency(cat.total_spent)}
                  {cat.monthly_budget > 0 && (
                    <span className="text-text-tertiary">
                      {" "}
                      / {formatCurrency(cat.monthly_budget)}
                    </span>
                  )}
                </span>
              </div>
              {cat.monthly_budget > 0 && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className={`h-full rounded-full ${
                      isOver ? "bg-status-red" : "bg-accent"
                    }`}
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Account Summary ---------- */

function AccountSummary({ accounts }: { accounts: Account[] }) {
  return (
    <div className="rounded-2xl border border-border-default bg-bg-secondary p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">Accounts</h2>
        <PlaidLinkButton variant="secondary" />
      </div>

      {accounts.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <p className="text-sm text-text-tertiary">No accounts connected</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-text-primary">
                  {acct.name}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {acct.institution_name}
                  {acct.last_synced_at && (
                    <> &middot; Synced {formatDate(acct.last_synced_at)}</>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-[13px] font-medium tabular-nums text-text-primary">
                {acct.current_balance != null
                  ? formatCurrencyPrecise(acct.current_balance)
                  : "\u2014"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
