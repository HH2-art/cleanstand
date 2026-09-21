import { notFound } from "next/navigation";
import { updateExpenseItem } from "@/app/actions/expenses";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "../ExpenseForm";

export default async function EditExpenseItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("expense_items")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (!item) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">경비 항목 수정</h1>
      <ExpenseForm action={updateExpenseItem} defaultValues={item} submitLabel="저장" />
    </main>
  );
}
