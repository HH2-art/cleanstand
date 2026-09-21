import type { ExpenseCategory } from "@/app/actions/expenses";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  supplies: "청소용품",
  equipment: "장비",
  uniform: "피복",
  transport: "운반",
  other: "기타",
};

export const CATEGORY_ORDER: ExpenseCategory[] = ["supplies", "equipment", "uniform", "transport", "other"];
