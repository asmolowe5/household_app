/**
 * Structured tool definitions for Gemini function calling.
 * These let the AI query the database for precise answers
 * instead of computing from context.
 */
export const AI_TOOLS = [
  {
    name: "get_category_spending",
    description: "Get the total spending for a specific budget category in the current month",
    parameters: {
      type: "object" as const,
      properties: {
        category_name: {
          type: "string",
          description: "The category name, e.g. 'Dining/Delivery', 'Groceries'",
        },
      },
      required: ["category_name"],
    },
  },
  {
    name: "get_merchant_spending",
    description: "Get total spending at a specific merchant in the current month",
    parameters: {
      type: "object" as const,
      properties: {
        merchant_name: {
          type: "string",
          description: "The merchant name or partial match, e.g. 'DoorDash', 'Amazon'",
        },
      },
      required: ["merchant_name"],
    },
  },
  {
    name: "get_budget_summary",
    description: "Get the overall budget summary including all categories, total spent, remaining, and daily allowance",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_savings_balance",
    description: "Get the current savings account balance",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_recent_transactions",
    description: "Get the most recent transactions, optionally filtered by merchant or category",
    parameters: {
      type: "object" as const,
      properties: {
        merchant_filter: {
          type: "string",
          description: "Optional merchant name to filter by",
        },
        limit: {
          type: "number",
          description: "Number of transactions to return (default 10)",
        },
      },
    },
  },
  {
    name: "create_category",
    description: "Create a new budget category",
    parameters: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Category name" },
        type: { type: "string", enum: ["fixed", "discretionary"], description: "Category type" },
        monthly_budget: { type: "number", description: "Monthly budget amount" },
        is_temporary: { type: "boolean", description: "Whether this is a temporary project category" },
      },
      required: ["name", "type", "monthly_budget"],
    },
  },
  {
    name: "recategorize_transaction",
    description: "Move a transaction to a different category",
    parameters: {
      type: "object" as const,
      properties: {
        transaction_id: { type: "string", description: "The transaction ID" },
        category_name: { type: "string", description: "Target category name" },
        create_rule: { type: "boolean", description: "Whether to create a rule for this merchant" },
      },
      required: ["transaction_id", "category_name"],
    },
  },
  {
    name: "update_budget",
    description: "Update the monthly budget amount for a category",
    parameters: {
      type: "object" as const,
      properties: {
        category_name: { type: "string", description: "Category name" },
        new_budget: { type: "number", description: "New monthly budget amount" },
      },
      required: ["category_name", "new_budget"],
    },
  },
];
