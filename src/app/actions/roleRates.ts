"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { recalculateRoleStandardRates } from "@/lib/services/roleRates";

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
