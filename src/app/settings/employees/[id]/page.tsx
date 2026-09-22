import { notFound } from "next/navigation";
import "@/styles/app-shell.css";
import "../employees.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { updateEmployee } from "@/app/actions/employees";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { EmployeeForm } from "../EmployeeForm";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (!employee) notFound();

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="employees" companyName={company.name} />
      <div className="main">
        <div className="employees-page employees-container">
          <div className="page-head">
            <h1>직원 정보 수정</h1>
            <p>{company.name}</p>
          </div>

          <div className="card" style={{ maxWidth: 480 }}>
            <h2>직원 정보</h2>
            <EmployeeForm action={updateEmployee} defaultValues={employee} submitLabel="저장" />
          </div>
        </div>
      </div>
    </div>
  );
}
