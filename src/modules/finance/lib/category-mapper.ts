// src/modules/finance/lib/category-mapper.ts
import type { Category, CategoryRule } from "@/modules/finance/types";

const PRIMARY_MAP: Record<string, string> = {
  FOOD_AND_DRINK: "Dining/Delivery",
  TRANSPORTATION: "Transportation",
  ENTERTAINMENT: "Entertainment",
};

const DETAILED_MAP: Record<string, string> = {
  GENERAL_MERCHANDISE_SUPERSTORES: "Groceries",
  GENERAL_MERCHANDISE_GROCERIES: "Groceries",
  RENT_AND_UTILITIES_RENT: "Rent/Mortgage",
  RENT_AND_UTILITIES_MORTGAGE: "Rent/Mortgage",
  RENT_AND_UTILITIES_GAS: "Utilities",
  RENT_AND_UTILITIES_ELECTRIC: "Utilities",
  RENT_AND_UTILITIES_WATER: "Utilities",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "Utilities",
  RENT_AND_UTILITIES_TELEPHONE: "Utilities",
  RENT_AND_UTILITIES_INTERNET: "Utilities",
  LOAN_PAYMENTS_INSURANCE_PAYMENT: "Insurance",
  GENERAL_SERVICES_INSURANCE: "Insurance",
  GENERAL_SERVICES_SUBSCRIPTION: "Subscriptions",
};

const TYPE_MAP: Record<string, string> = {
  INCOME: "income",
  TRANSFER_IN: "internal_transfer",
  TRANSFER_OUT: "internal_transfer",
};

interface MapResult {
  categoryId: string | null;
  transactionType: "expense" | "income" | "internal_transfer" | "savings_transfer";
  isReviewed: boolean;
}

export function mapTransaction(
  merchantName: string | null,
  plaidPrimary: string | null,
  plaidDetailed: string | null,
  categories: Category[],
  rules: CategoryRule[],
): MapResult {
  const defaultResult: MapResult = {
    categoryId: null,
    transactionType: "expense",
    isReviewed: false,
  };

  if (plaidPrimary && TYPE_MAP[plaidPrimary]) {
    return {
      categoryId: null,
      transactionType: TYPE_MAP[plaidPrimary] as MapResult["transactionType"],
      isReviewed: true,
    };
  }

  if (merchantName) {
    const lowerMerchant = merchantName.toLowerCase();
    const rule = rules.find((r) => lowerMerchant.includes(r.pattern.toLowerCase()));
    if (rule) {
      return {
        categoryId: rule.category_id,
        transactionType: "expense",
        isReviewed: true,
      };
    }
  }

  if (plaidDetailed && DETAILED_MAP[plaidDetailed]) {
    const portalName = DETAILED_MAP[plaidDetailed];
    const cat = categories.find((c) => c.name === portalName);
    if (cat) {
      return { categoryId: cat.id, transactionType: "expense", isReviewed: false };
    }
  }

  if (plaidPrimary && PRIMARY_MAP[plaidPrimary]) {
    const portalName = PRIMARY_MAP[plaidPrimary];
    const cat = categories.find((c) => c.name === portalName);
    if (cat) {
      return { categoryId: cat.id, transactionType: "expense", isReviewed: false };
    }
  }

  return defaultResult;
}
