"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { recalculateRoleStandardRates } from "@/lib/services/roleRates";
import { calculateWeightedHourlyRate, totalMonthlyCost } from "@/lib/calc/roleRate";

function won(n: number) {
  return Math.round(n).toLocaleString("ko-KR");
}

export async function setRoleRateOverride(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const roleName = String(formData.get("role_name") ?? "").trim();
  const rate = Number(formData.get("standard_hourly_rate"));
  if (!roleName || Number.isNaN(rate) || rate < 0) return;

  const supabase = await createClient();
  await supabase.from("role_standard_rates").upsert(
    {
      company_id: company.id,
      role_name: roleName,
      standard_hourly_rate: rate,
      is_manual_override: true,
    },
    { onConflict: "company_id,role_name" },
  );

  revalidatePath("/settings/employees");
}

/** 수동 오버라이드를 해제하고 가중평균 자동계산으로 되돌린다. */
export async function clearRoleRateOverride(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const roleName = String(formData.get("role_name") ?? "").trim();
  if (!roleName) return;

  const supabase = await createClient();
  await supabase
    .from("role_standard_rates")
    .update({ is_manual_override: false })
    .eq("company_id", company.id)
    .eq("role_name", roleName);

  await recalculateRoleStandardRates(company.id);
  revalidatePath("/settings/employees");
}

export type RoleRateActionState = { error: string } | null;

export type RenameRoleRateState = { error: string } | { needsConfirm: true; newName: string; message: string } | null;

/**
 * 역할명을 바꾼다 — 그 역할을 쓰는 직원들의 role과 role_standard_rates 행도 함께 옮긴다.
 * 새 이름이 기존 역할과 겹치면(병합) 자동으로 합치지 않고, 먼저 평균 미리보기를 보여준
 * 뒤 confirm_merge=true로 다시 제출해야만 실제로 병합한다.
 */
export async function renameRoleRate(
  _prevState: RenameRoleRateState,
  formData: FormData,
): Promise<RenameRoleRateState> {
  const company = await requireCurrentCompany();
  const oldName = String(formData.get("old_role_name") ?? "").trim();
  const newName = String(formData.get("new_role_name") ?? "").trim();
  const confirmMerge = formData.get("confirm_merge") === "true";
  if (!oldName || !newName) return { error: "역할명을 입력해주세요." };
  if (oldName === newName) return null;

  const supabase = await createClient();

  const [{ data: oldRow }, { data: existingTarget }] = await Promise.all([
    supabase
      .from("role_standard_rates")
      .select("standard_hourly_rate")
      .eq("company_id", company.id)
      .eq("role_name", oldName)
      .maybeSingle(),
    supabase
      .from("role_standard_rates")
      .select("standard_hourly_rate, is_manual_override")
      .eq("company_id", company.id)
      .eq("role_name", newName)
      .maybeSingle(),
  ]);

  if (existingTarget && !confirmMerge) {
    // 병합 미리보기만 계산하고 아직 아무것도 바꾸지 않는다 — 명시적 동의 후에만 진행.
    let mergedRate = existingTarget.standard_hourly_rate;
    if (!existingTarget.is_manual_override) {
      const { data: employees } = await supabase
        .from("employees")
        .select("base_salary, annual_leave_allowance, retirement_provision, insurance_burden, other_company_cost, monthly_work_hours")
        .eq("company_id", company.id)
        .eq("active", true)
        .in("role", [oldName, newName]);
      const computed = calculateWeightedHourlyRate(
        (employees ?? []).map((e) => ({
          monthlyCost: totalMonthlyCost({
            baseSalary: e.base_salary,
            annualLeaveAllowance: e.annual_leave_allowance,
            retirementProvision: e.retirement_provision,
            insuranceBurden: e.insurance_burden,
            otherCompanyCost: e.other_company_cost,
          }),
          monthlyWorkHours: e.monthly_work_hours,
        })),
      );
      if (computed !== null) mergedRate = computed;
    }

    const oldRate = oldRow?.standard_hourly_rate ?? 0;
    const message = existingTarget.is_manual_override
      ? `이미 '${newName}' 역할이 있습니다(수동 설정값 ${won(mergedRate)}원/h). 두 역할을 합치시겠습니까? 합치면 '${oldName}'의 직원들도 '${newName}' 역할로 옮겨지고, 표준단가는 계속 수동 설정값 ${won(mergedRate)}원/h로 유지됩니다.`
      : `이미 '${newName}' 역할이 있습니다. 두 역할을 합치시겠습니까? 합치면 시급이 ${won(oldRate)}원 → ${won(mergedRate)}원(평균)으로 바뀝니다.`;

    return { needsConfirm: true, newName, message };
  }

  await supabase.from("employees").update({ role: newName }).eq("company_id", company.id).eq("role", oldName);

  if (existingTarget) {
    // newName 행이 이미 있으면(두 역할을 합치는 셈, 사용자가 방금 명시적으로 동의함) 옛
    // 행은 지우고, 합쳐진 인원 기준으로 recalculateRoleStandardRates가 다시 계산하게 둔다.
    await supabase.from("role_standard_rates").delete().eq("company_id", company.id).eq("role_name", oldName);
  } else {
    await supabase
      .from("role_standard_rates")
      .update({ role_name: newName })
      .eq("company_id", company.id)
      .eq("role_name", oldName);
  }

  await recalculateRoleStandardRates(company.id);
  revalidatePath("/settings/employees");
  return null;
}

/** 역할을 삭제한다 — 그 역할로 등록된 직원이 있으면 참조 무결성이 깨지므로 막는다. */
export async function deleteRoleRate(
  _prevState: RoleRateActionState,
  formData: FormData,
): Promise<RoleRateActionState> {
  const company = await requireCurrentCompany();
  const roleName = String(formData.get("role_name") ?? "").trim();
  if (!roleName) return null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", company.id)
    .eq("role", roleName);

  if (count && count > 0) {
    return { error: `이 역할로 등록된 직원이 ${count}명 있어 삭제할 수 없습니다. 먼저 직원 역할을 변경해주세요.` };
  }

  await supabase.from("role_standard_rates").delete().eq("company_id", company.id).eq("role_name", roleName);
  revalidatePath("/settings/employees");
  return null;
}
