import type { CategoryRule, Category } from "@/modules/finance/types";

const PLAID_CATEGORY_MAP: Record<string, string> = {
  "food and drink": "Dining/Delivery",
  "restaurants": "Dining/Delivery",
  "groceries": "Groceries",
  "shops": "Shopping",
  "transportation": "Transportation",
  "entertainment": "Entertainment",
  "recreation": "Entertainment",
  "service": "Personal",
  "healthcare": "Personal",
  "utilities": "Utilities",
  "rent": "Rent/Mortgage",
  "mortgage": "Rent/Mortgage",
  "insurance": "Insurance",
  "subscription": "Subscriptions",
};

export function categorizeTransaction(
  merchantName: string | null,
  plaidCategories: string[] | null,
  rules: CategoryRule[],
  categories: Category[]
): string | null {
  const merchant = (merchantName ?? "").toLowerCase();

  const userRules = rules.filter((r) => r.source === "user");
  const aiRules = rules.filter((r) => r.source === "ai");

  for (const rule of [...userRules, ...aiRules]) {
    if (merchant.includes(rule.pattern.toLowerCase())) {
      return rule.category_id;
    }
  }

  if (plaidCategories && plaidCategories.length > 0) {
    for (const plaidCat of plaidCategories) {
      const mapped = PLAID_CATEGORY_MAP[plaidCat.toLowerCase()];
      if (mapped) {
        const category = categories.find((c) => c.name === mapped);
        if (category) return category.id;
      }
    }
  }

  return null;
}
