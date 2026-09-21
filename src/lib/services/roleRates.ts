import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateWeightedHourlyRate, totalMonthlyCost } from "@/lib/calc/roleRate";

/**
 * 회사의 활성 직원들을 role별로 묶어 가중평균 표준원가를 다시 계산하고
 * role_standard_rates에 반영한다. is_manual_override=true인 role은 건드리지
 * 않는다(사장님이 수동으로 잡아둔 값을 자동계산이 덮어쓰지 않음).
 *
 * 직원 추가/수정/삭제/활성상태 변경 직후 항상 호출한다.
 */
export async function recalculateRoleStandardRates(companyId: string): Promise<void> {
  const supabase = await createClient();

  const [{ data: employees }, { data: existingRates }] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "role, base_salary, annual_leave_allowance, retirement_provision, insurance_burden, other_company_cost, monthly_work_hours",
      )
      .eq("company_id", companyId)
      .eq("active", true),
    supabase
      .from("role_standard_rates")
      .select("role_name, is_manual_override")
      .eq("company_id", companyId),
  ]);

  const overriddenRoles = new Set(
    (existingRates ?? []).filter((r) => r.is_manual_override).map((r) => r.role_name),
  );

  const grouped = new Map<string, { monthlyCost: number; monthlyWorkHours: number }[]>();
  for (const emp of employees ?? []) {
    if (overriddenRoles.has(emp.role)) continue;
    const list = grouped.get(emp.role) ?? [];
    list.push({
      monthlyCost: totalMonthlyCost({
        baseSalary: emp.base_salary,
        annualLeaveAllowance: emp.annual_leave_allowance,
        retirementProvision: emp.retirement_provision,
        insuranceBurden: emp.insurance_burden,
        otherCompanyCost: emp.other_company_cost,
      }),
      monthlyWorkHours: emp.monthly_work_hours,
    });
    grouped.set(emp.role, list);
  }

  for (const [role, list] of grouped) {
    const rate = calculateWeightedHourlyRate(list);
    if (rate === null) continue;

    await supabase.from("role_standard_rates").upsert(
      {
        company_id: companyId,
        role_name: role,
        standard_hourly_rate: rate,
        is_manual_override: false,
      },
      { onConflict: "company_id,role_name" },
    );
  }
}
