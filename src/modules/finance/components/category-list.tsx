import { CategoryRow } from "./category-row";
import type { CategoryBudgetStatus } from "@/modules/finance/types";

interface CategoryListProps {
  categories: CategoryBudgetStatus[];
}

export function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-8 text-text-tertiary text-sm">
        No budget categories set up yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-bg-secondary">
      {categories.map((item) => (
        <CategoryRow key={item.category.id} item={item} />
      ))}
    </div>
  );
}
