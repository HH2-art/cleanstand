import "@/styles/app-shell.css";
import "./expenses.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createExpenseItem, type ExpenseCategory } from "@/app/actions/expenses";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseListContent, type ExpenseRow } from "./ExpenseListContent";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export default async function ExpensesPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("expense_items")
    .select("*")
    .eq("company_id", company.id)
    .order("category")
    .order("name");

  const rows: ExpenseRow[] = (items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category as ExpenseCategory,
    unitCost: item.unit_cost,
    isActive: item.is_active,
    note: item.note,
    registeredDate: formatDate(item.created_at),
  }));

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="expenses" companyName={company.name} logoUrl={company.logo_url} />
      <div className="main">
        <div className="expenses-page expenses-container">
          <div className="page-head-row">
            <div className="page-head">
              <h1>경비 항목</h1>
              <p>
                견적 계산에 사용되는 경비 항목을 관리합니다. 장비, 소모품, 차량, 유지비 등 회사에서 사용하는 항목을
                등록하고 필요에 따라 수정하거나 삭제할 수 있습니다.
              </p>
            </div>
            <details>
              <summary className="btn btn-primary">
                <PlusIcon /> 경비 항목 추가
              </summary>
              <ExpenseForm action={createExpenseItem} submitLabel="추가" layout="add" />
            </details>
          </div>

          <div className="info-banner">
            <InfoIcon />
            <span>경비 항목은 견적 계산 시 자동으로 반영됩니다. 추가한 항목은 견적서 작성 시 선택하여 사용할 수 있습니다.</span>
          </div>

          <ExpenseListContent items={rows} />
        </div>
      </div>
    </div>
  );
}
