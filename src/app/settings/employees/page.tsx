import "@/styles/app-shell.css";
import "./employees.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { createEmployee } from "@/app/actions/employees";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeListContent, type EmployeeRow } from "./EmployeeListContent";
import { RoleRatesPanel } from "./RoleRatesPanel";

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export default async function EmployeesPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const [{ data: employees }, { data: roleRates }] = await Promise.all([
    supabase.from("employees").select("*").eq("company_id", company.id).order("created_at"),
    supabase
      .from("role_standard_rates")
      .select("role_name, standard_hourly_rate, is_manual_override")
      .eq("company_id", company.id)
      .order("role_name"),
  ]);

  const employeeRows: EmployeeRow[] = (employees ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    monthlyWorkHours: Number(e.monthly_work_hours),
    active: e.active,
    joinedDate: formatJoinedDate(e.created_at),
  }));

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="employees" companyName={company.name} logoUrl={company.logo_url} />
      <div className="main">
        <div className="employees-page employees-container">
          <div className="page-head">
            <h1>직원 관리</h1>
            <p>{company.name}</p>
          </div>

          <div className="two-col">
            <div className="col-left">
              <RoleRatesPanel rates={roleRates ?? []} />
              <EmployeeListContent employees={employeeRows} />
            </div>

            <div className="card col-right">
              <h2>직원 추가</h2>
              <EmployeeForm action={createEmployee} submitLabel="추가" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
