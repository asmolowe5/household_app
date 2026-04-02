import type { TransactionType } from "@/modules/finance/types";

interface ClassifierInput {
  amount: number;
  accountType: string;
  accountSubtype: string | null;
  merchantName: string | null;
  plaidCategory: string[] | null;
  accountName: string;
}

export function classifyTransaction(input: ClassifierInput): TransactionType {
  const { amount, accountSubtype, plaidCategory, merchantName, accountName } = input;

  if (amount < 0 && accountSubtype === "checking") {
    const name = (merchantName ?? "").toLowerCase();
    if (name.includes("sofi") || name.includes("savings") || name.includes("transfer from")) {
      return "savings_transfer";
    }
    const categories = plaidCategory ?? [];
    if (
      categories.some((c) => c.toLowerCase().includes("payroll")) ||
      name.includes("direct dep") ||
      name.includes("payroll")
    ) {
      return "income";
    }
    return "income";
  }

  if (amount > 0 && (accountSubtype === "savings" || accountName.toLowerCase().includes("savings"))) {
    return "savings_transfer";
  }

  if (amount < 0 && (accountSubtype === "savings" || accountName.toLowerCase().includes("savings"))) {
    return "savings_transfer";
  }

  const name = (merchantName ?? "").toLowerCase();
  if (name.includes("transfer") && !name.includes("venmo") && !name.includes("zelle")) {
    return "internal_transfer";
  }

  return "expense";
}
