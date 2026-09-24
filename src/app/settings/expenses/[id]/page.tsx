import { notFound } from "next/navigation";
import "@/styles/app-shell.css";
import "../expenses.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
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
    <div className="cs-app-shell shell">
      <AppSidebar current="expenses" companyName={company.name} logoUrl={company.logo_url} />
      <div className="main">
        <div className="expenses-page" style={{ maxWidth: 480, margin: "0 auto", padding: "24px 32px" }}>
          <div className="page-head">
            <h1>경비 항목 수정</h1>
            <p>{company.name}</p>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <ExpenseForm action={updateExpenseItem} defaultValues={item} submitLabel="저장" layout="edit" />
          </div>
        </div>
      </div>
    </div>
  );
}
