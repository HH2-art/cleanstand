"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { recalculateRoleStandardRates } from "@/lib/services/roleRates";
import { logActivity } from "@/lib/activityLog";

export type EmployeeActionState = { error: string } | null;

interface EmployeeFields {
  name: string;
  role: string;
  base_salary: number;
  annual_leave_allowance: number;
  retirement_provision: number;
  insurance_burden: number;
  other_company_cost: number;
  monthly_work_hours: number;
  active: boolean;
}

function parseEmployeeFields(formData: FormData): EmployeeFields | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  if (!name) return { error: "이름을 입력해주세요." };
  if (!role) return { error: "역할을 입력해주세요." };

  const numberFields = [
    "base_salary",
    "annual_leave_allowance",
    "retirement_provision",
    "insurance_burden",
    "other_company_cost",
    "monthly_work_hours",
  ] as const;

  const parsed: Record<string, number> = {};
  for (const field of numberFields) {
    const value = Number(formData.get(field) ?? 0);
    if (Number.isNaN(value) || value < 0) {
      return { error: `${field}는 0 이상의 숫자여야 합니다.` };
    }
    parsed[field] = value;
  }
  if (parsed.monthly_work_hours === 0) {
    return { error: "월 투입 가능시간은 0보다 커야 합니다." };
  }

  return {
    name,
    role,
    base_salary: parsed.base_salary,
    annual_leave_allowance: parsed.annual_leave_allowance,
    retirement_provision: parsed.retirement_provision,
    insurance_burden: parsed.insurance_burden,
    other_company_cost: parsed.other_company_cost,
    monthly_work_hours: parsed.monthly_work_hours,
    active: formData.get("active") === "on",
  };
}

export async function createEmployee(
  _prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const company = await requireCurrentCompany();
  const fields = parseEmployeeFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({ company_id: company.id, ...fields });
  if (error) return { error: error.message };

  await recalculateRoleStandardRates(company.id);
  await logActivity(supabase, company.id, company.owner_id, "employee_added", `"${fields.name}" 직원을 추가했습니다.`);
  revalidatePath("/settings/employees");
  redirect("/settings/employees");
}

export async function updateEmployee(
  _prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const company = await requireCurrentCompany();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "잘못된 요청입니다." };

  const fields = parseEmployeeFields(formData);
  if ("error" in fields) return fields;

  const supabase = await createClient();
  const { error } = await supabase.from("employees").update(fields).eq("id", id).eq("company_id", company.id);
  if (error) return { error: error.message };

  await recalculateRoleStandardRates(company.id);
  await logActivity(supabase, company.id, company.owner_id, "employee_updated", `"${fields.name}" 직원 정보를 수정했습니다.`, id);
  revalidatePath("/settings/employees");
  redirect("/settings/employees");
}

export async function deleteEmployee(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("name")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();

  await supabase.from("employees").delete().eq("id", id).eq("company_id", company.id);

  await recalculateRoleStandardRates(company.id);
  if (employee) {
    await logActivity(supabase, company.id, company.owner_id, "employee_removed", `"${employee.name}" 직원을 삭제했습니다.`, id);
  }
  revalidatePath("/settings/employees");
}
