"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";

export type ExpenseActionState = { error: string } | null;

const CATEGORIES = ["supplies", "equipment", "uniform", "transport", "other"] as const;
export type ExpenseCategory = (typeof CATEGORIES)[number];

interface ExpenseFields {
  name: string;
  category: ExpenseCategory;
  unit_cost: number;
}

function parseExpenseFields(formData: FormData): ExpenseFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const unitCost = Number(formData.get("unit_cost"));

  if (!name) return { error: "이름을 입력해주세요." };
  if (!CATEGORIES.includes(category as ExpenseCategory)) return { error: "카테고리를 선택해주세요." };
  if (Number.isNaN(unitCost) || unitCost < 0) return { error: "단가는 0 이상의 숫자여야 합니다." };

  return { name, category: category as ExpenseCategory, unit_cost: unitCost };
}

export async function createExpenseItem(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const company = await requireCurrentCompany();
  const fields = parseExpenseFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { error } = await supabase.from("expense_items").insert({ company_id: company.id, ...fields });
  if (error) return { error: error.message };

  await logActivity(supabase, company.id, company.owner_id, "expense_item_added", `"${fields.name}" 경비항목을 추가했습니다.`);
  revalidatePath("/settings/expenses");
  redirect("/settings/expenses");
}

export async function updateExpenseItem(
  _prevState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const company = await requireCurrentCompany();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const fields = parseExpenseFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { error } = await supabase.from("expense_items").update(fields).eq("id", id).eq("company_id", company.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/expenses");
  redirect("/settings/expenses");
}

export async function deleteExpenseItem(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("expense_items").delete().eq("id", id).eq("company_id", company.id);

  revalidatePath("/settings/expenses");
}
