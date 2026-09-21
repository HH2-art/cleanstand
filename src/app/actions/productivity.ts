"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_WORK_TYPES } from "@/lib/workTypeLabels";

/** work_type을 수정하면 회사 전용 row로 저장한다. 업계 기본값(company_id null)은 절대 건드리지 않는다. */
export async function upsertProductivityOverride(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const workType = String(formData.get("work_type") ?? "").trim();
  const sqmPerHour = Number(formData.get("sqm_per_hour"));
  if (!workType || Number.isNaN(sqmPerHour) || sqmPerHour <= 0) return;

  const supabase = await createClient();
  await supabase.from("productivity_rates").upsert(
    { company_id: company.id, work_type: workType, sqm_per_hour: sqmPerHour },
    { onConflict: "company_id,work_type" },
  );

  revalidatePath("/settings/productivity");
}

/** 업계 기본값 8종 중 하나의 회사 커스텀 오버라이드를 지우고 기본값으로 되돌린다. */
export async function resetProductivityRate(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const workType = String(formData.get("work_type") ?? "").trim();
  if (!workType) return;

  const supabase = await createClient();
  await supabase.from("productivity_rates").delete().eq("company_id", company.id).eq("work_type", workType);

  revalidatePath("/settings/productivity");
}

/** 업계 기본값 8종의 회사 커스텀값을 전부 지운다("기본값으로 되돌리기" 전체 초기화). 회사가 직접 추가한 커스텀 작업유형은 건드리지 않는다. */
export async function resetAllProductivityOverrides(): Promise<void> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  await supabase
    .from("productivity_rates")
    .delete()
    .eq("company_id", company.id)
    .in("work_type", KNOWN_WORK_TYPES);

  revalidatePath("/settings/productivity");
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "item";
}

/**
 * 회사가 새 커스텀 작업유형을 추가할 때 work_type(슬러그)을 이름에서 자동 생성한다.
 * 한글 이름은 그대로 슬러그로 옮길 수 없어서(ASCII만 가능) "custom_" + 영문/숫자만
 * 남긴 슬러그 형태고, 슬러그가 비면 "custom_item"으로 대체한다. 중복되면 _2, _3...
 */
async function generateUniqueWorkType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  name: string,
): Promise<string> {
  const base = "custom_" + slugify(name);
  const { data: existing } = await supabase
    .from("productivity_rates")
    .select("work_type")
    .eq("company_id", companyId)
    .like("work_type", `${base}%`);

  const taken = new Set((existing ?? []).map((r) => r.work_type as string));
  if (!taken.has(base)) return base;

  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

/** 업계 기본값에도 없는 새 작업유형을 회사가 직접 추가한다. 이름은 display_name에, work_type은 자동 생성한 슬러그에 저장. */
export async function createCustomWorkType(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const name = String(formData.get("new_name") ?? "").trim();
  const sqmPerHour = Number(formData.get("new_sqm_per_hour"));
  if (!name || Number.isNaN(sqmPerHour) || sqmPerHour <= 0) return;

  const supabase = await createClient();
  const workType = await generateUniqueWorkType(supabase, company.id, name);

  await supabase.from("productivity_rates").insert({
    company_id: company.id,
    work_type: workType,
    sqm_per_hour: sqmPerHour,
    display_name: name,
  });

  revalidatePath("/settings/productivity");
}

/** 회사 커스텀 작업유형의 표시 이름만 바꾼다(work_type 슬러그는 그대로 유지). */
export async function renameCustomWorkType(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const workType = String(formData.get("work_type") ?? "").trim();
  const name = String(formData.get("new_name") ?? "").trim();
  if (!workType || !name) return;

  const supabase = await createClient();
  await supabase
    .from("productivity_rates")
    .update({ display_name: name })
    .eq("company_id", company.id)
    .eq("work_type", workType);

  revalidatePath("/settings/productivity");
}

/** 회사 커스텀 작업유형을 완전히 삭제한다(업계 기본값에는 없는 항목이라 "되돌리기"가 아니라 삭제). */
export async function deleteCustomWorkType(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const workType = String(formData.get("work_type") ?? "").trim();
  if (!workType) return;

  const supabase = await createClient();
  await supabase.from("productivity_rates").delete().eq("company_id", company.id).eq("work_type", workType);

  revalidatePath("/settings/productivity");
}
