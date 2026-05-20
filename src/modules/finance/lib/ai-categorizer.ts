import { GoogleGenAI } from "@google/genai";

interface DBInstanceCategory {
  id: string;
  name: string;
}

export async function categorizeTransactionWithAI(
  merchantName: string,
  plaidCategories: string[],
  amount: number,
  availableCategories: DBInstanceCategory[],
): Promise<{ categoryId: string | null; reasoning: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("AI Categorization skipped: GEMINI_API_KEY is not configured.");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const categoryNamesList = availableCategories.map((c) => c.name);

    const prompt = `You are a financial assistant for a household portal. Your job is to categorize a financial transaction into one of the user's defined categories.

Available Categories:
${categoryNamesList.map((name) => `- ${name}`).join("\n")}

Transaction Details:
- Merchant Name / Description: "${merchantName}"
- Amount: $${Math.abs(amount).toFixed(2)}
- Plaid Raw Categories: ${plaidCategories.join(", ") || "None"}

Please choose the category from the list above that best fits this transaction. If none of the categories fits, return null for the category name. Return your response as a JSON object with:
{
  "categoryName": "name of the selected category, or null if none fit",
  "reasoning": "brief explanation of why you matched it"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return null;

    const result = JSON.parse(text);
    const matchedCategoryName = result.categoryName;
    const reasoning = result.reasoning ?? "";

    if (!matchedCategoryName) {
      return { categoryId: null, reasoning: "AI matched no category" };
    }

    const matchedCategory = availableCategories.find(
      (c) => c.name.toLowerCase() === matchedCategoryName.toLowerCase(),
    );

    return {
      categoryId: matchedCategory ? matchedCategory.id : null,
      reasoning: reasoning || `AI mapped to ${matchedCategoryName}`,
    };
  } catch (error) {
    console.error("AI Categorization Error:", error);
    return null;
  }
}
