"use server";

import { redirect } from "next/navigation";
import { requireCurrentCompany } from "@/lib/company";
import { calculateQuote } from "@/lib/calc/quote";
import type { PrivateLaborLine, PrivateQuoteInput, PublicLaborLine, PublicQuoteInput, RegulationVersion } from "@/lib/calc/types";
import { mergeProductivityRates } from "@/lib/productivityMerge";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";

const STATUS_LABELS: Record<string, string> = { draft: "임시저장", sent: "발송완료", won: "수주성공", lost: "수주실패" };
// "으로"/"로" 받침 유무에 따른 조사 — 라벨 4개가 고정이라 하드코딩.
const STATUS_PARTICLE: Record<string, string> = { draft: "으로", sent: "로", won: "으로", lost: "로" };

export interface QuoteFormPayload {
  mode: "private" | "public";
  buildingName: string;
  buildingType: string;
  workType: string;
  areaSqm: number;
  frequencyPerWeek: number;
  siteConditions: Record<string, unknown>;
  privateLaborLines: PrivateLaborLine[]; // private 모드에서 사용
  publicLaborLines: PublicLaborLine[]; // public 모드에서 사용
  legalCost: number; // public
  expenseItemIds: string[];
  generalAdminRate: number;
  profitRate: number;
  vatRate: number;
}

export type CreateQuoteResult = { error: string } | { success: true; id: string };

/**
 * 신뢰 경계: 면적/빈도/역할별 인원수·비율 등 "회사가 자기 견적에 대해 자유롭게 정하는
 * 값"은 클라이언트가 보낸 값을 그대로 쓴다. 반면 생산성기준·경비단가·공공 법정기준값처럼
 * "DB에 저장된 공식 값이어야 하는 것"은 클라이언트가 뭘 보내든 무시하고 항상 서버에서
 * 다시 조회한다 — 최종 저장되는 금액은 항상 서버가 이 함수 안에서 새로 계산한 값이다.
 */
export async function createQuote(payload: QuoteFormPayload): Promise<CreateQuoteResult> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  if (!payload.buildingName.trim()) return { error: "현장명을 입력해주세요." };
  if (!payload.workType) return { error: "청소범위를 선택해주세요." };
  if (!payload.areaSqm || payload.areaSqm <= 0) return { error: "면적을 입력해주세요." };
  if (!payload.frequencyPerWeek || payload.frequencyPerWeek <= 0) return { error: "빈도를 입력해주세요." };

  const [{ data: globalRates }, { data: companyRates }] = await Promise.all([
    supabase.from("productivity_rates").select("work_type, sqm_per_hour").is("company_id", null),
    supabase.from("productivity_rates").select("work_type, sqm_per_hour").eq("company_id", company.id),
  ]);
  const productivity = mergeProductivityRates(globalRates ?? [], companyRates ?? []).find(
    (r) => r.work_type === payload.workType,
  );
  if (!productivity) return { error: "선택한 청소범위의 생산성 기준을 찾을 수 없습니다." };

  let expenses: { name: string; amount: number }[] = [];
  if (payload.expenseItemIds.length > 0) {
    const { data: expenseRows } = await supabase
      .from("expense_items")
      .select("name, unit_cost")
      .eq("company_id", company.id)
      .in("id", payload.expenseItemIds);
    expenses = (expenseRows ?? []).map((row) => ({ name: row.name, amount: row.unit_cost }));
  }

  const site = {
    areaSqm: payload.areaSqm,
    sqmPerHour: productivity.sqmPerHour,
    frequencyPerWeek: payload.frequencyPerWeek,
  };

  let input: PrivateQuoteInput | PublicQuoteInput;
  let regulationVersionId: string | null = null;

  if (payload.mode === "private") {
    const laborLines = payload.privateLaborLines.filter((line) => line.workerCount > 0);
    if (laborLines.length === 0) return { error: "역할을 최소 1개 이상 추가하고 인원수를 입력해주세요." };
    if (laborLines.some((line) => !line.roleName.trim() || line.hourlyRate <= 0)) {
      return { error: "역할별 표준 시급원가를 입력해주세요." };
    }
    input = {
      mode: "private",
      site,
      laborLines,
      expenses,
      generalAdminRate: payload.generalAdminRate,
      profitRate: payload.profitRate,
      vatRate: payload.vatRate,
    };
  } else {
    const laborLines = payload.publicLaborLines.filter((line) => line.workerCount > 0);
    if (laborLines.length === 0) return { error: "역할을 최소 1개 이상 추가하고 인원수를 입력해주세요." };

    const { data: regulationRow } = await supabase
      .from("regulation_versions")
      .select("*")
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!regulationRow) return { error: "공공입찰 법정기준값이 아직 등록되지 않았습니다." };

    const regulation: RegulationVersion = {
      effectiveDate: regulationRow.effective_date,
      label: regulationRow.label,
      generalAdminRateCap: regulationRow.general_admin_rate_cap,
      profitRateCap: regulationRow.profit_rate_cap,
      simpleLaborDailyWage: regulationRow.simple_labor_daily_wage,
      foremanDailyWage: regulationRow.foreman_daily_wage,
      nationalPensionCompanyRate: regulationRow.national_pension_company_rate,
      healthInsuranceCompanyRate: regulationRow.health_insurance_company_rate,
      longTermCareCompanyRate: regulationRow.long_term_care_company_rate,
      employmentInsuranceCompanyRate: regulationRow.employment_insurance_company_rate,
      industrialAccidentRate: regulationRow.industrial_accident_rate,
    };
    regulationVersionId = regulationRow.id;

    input = {
      mode: "public",
      site,
      laborLines,
      expenses,
      legalCost: payload.legalCost > 0 ? payload.legalCost : 0,
      generalAdminRate: payload.generalAdminRate,
      profitRate: payload.profitRate,
      vatRate: payload.vatRate,
      regulation,
    };
  }

  const result = calculateQuote(input);

  const { data: quoteRow, error } = await supabase
    .from("quotes")
    .insert({
      company_id: company.id,
      mode: payload.mode,
      regulation_version_id: regulationVersionId,
      status: "draft",
      building_type: payload.buildingType || null,
      building_name: payload.buildingName,
      area_sqm: payload.areaSqm,
      frequency_per_week: payload.frequencyPerWeek,
      site_conditions: payload.siteConditions,
      estimated_hours: result.estimatedHours,
      estimated_workers: result.estimatedWorkers,
      labor_cost: result.laborCost,
      legal_cost: result.legalCost,
      expense_cost: result.expenseCost,
      admin_cost: result.adminCost,
      profit_amount: result.profitAmount,
      supply_amount: result.supplyAmount,
      vat_amount: result.vatAmount,
      quote_amount: result.quoteAmount,
    })
    .select("id")
    .single();

  if (error || !quoteRow) return { error: error?.message ?? "견적 저장에 실패했습니다." };

  const lineItems = result.lineItems.map((item, index) => ({
    quote_id: quoteRow.id,
    category: item.category,
    label: item.label,
    amount: item.amount,
    sort_order: index,
    role_name: item.roleName ?? null,
    worker_count: item.workerCount ?? null,
  }));
  const { error: lineItemsError } = await supabase.from("quote_line_items").insert(lineItems);
  if (lineItemsError) return { error: lineItemsError.message };

  redirect(`/quotes/${quoteRow.id}`);
}

export interface PastQuoteSummary {
  id: string;
  buildingName: string;
  areaSqm: number;
  frequencyPerWeek: number;
  mode: "private" | "public";
  quoteAmount: number;
  createdAt: string;
}

/** 새 견적 화면의 "지난 견적 참고" 목록 — 같은 건물유형의 최근 견적 5건. */
export async function listPastQuotesByBuildingType(buildingType: string): Promise<PastQuoteSummary[]> {
  const company = await requireCurrentCompany();
  if (!buildingType) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("quotes")
    .select("id, building_name, area_sqm, frequency_per_week, mode, quote_amount, created_at")
    .eq("company_id", company.id)
    .eq("building_type", buildingType)
    .order("created_at", { ascending: false })
    .limit(5);

  return (data ?? []).map((row) => ({
    id: row.id,
    buildingName: row.building_name ?? "-",
    areaSqm: Number(row.area_sqm),
    frequencyPerWeek: row.frequency_per_week,
    mode: row.mode,
    quoteAmount: Number(row.quote_amount),
    createdAt: row.created_at,
  }));
}

const REUSE_PUBLIC_ROLE_BY_LABEL: Record<string, PublicLaborLine["laborRole"]> = {
  "단순노무종사원": "simple",
  "작업반장": "foreman",
};

export interface ReusableQuoteData {
  mode: "private" | "public";
  areaSqm: number;
  frequencyPerWeek: number;
  privateLaborLines: { roleName: string; workerCount: number }[];
  publicLaborLines: PublicLaborLine[];
}

/** 지난 견적의 면적·빈도·인원 구성을 새 견적의 출발점으로 불러온다. */
export async function getQuoteForReuse(quoteId: string): Promise<ReusableQuoteData | null> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("mode, area_sqm, frequency_per_week")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!quote) return null;

  const { data: laborItems } = await supabase
    .from("quote_line_items")
    .select("role_name, worker_count")
    .eq("quote_id", quoteId)
    .eq("category", "labor");

  const rows = (laborItems ?? []).filter((item) => item.role_name && item.worker_count);

  return {
    mode: quote.mode,
    areaSqm: Number(quote.area_sqm),
    frequencyPerWeek: quote.frequency_per_week,
    privateLaborLines:
      quote.mode === "private"
        ? rows.map((item) => ({ roleName: item.role_name as string, workerCount: Number(item.worker_count) }))
        : [],
    publicLaborLines:
      quote.mode === "public"
        ? rows
            .map((item) => ({
              laborRole: REUSE_PUBLIC_ROLE_BY_LABEL[item.role_name as string],
              workerCount: Number(item.worker_count),
            }))
            .filter((line): line is PublicLaborLine => Boolean(line.laborRole))
        : [],
  };
}

export async function updateQuoteStatus(formData: FormData): Promise<void> {
  const company = await requireCurrentCompany();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["draft", "sent", "won", "lost"].includes(status)) return;

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", id)
    .eq("company_id", company.id)
    .select("building_name")
    .single();

  if (quote) {
    const buildingName = quote.building_name ?? "이름 없는 현장";
    await logActivity(
      supabase,
      company.id,
      company.owner_id,
      status === "sent" ? "quote_sent" : "quote_status_changed",
      `"${buildingName}" 견적 상태를 ${STATUS_LABELS[status]}${STATUS_PARTICLE[status]} 변경했습니다.`,
      id,
    );
  }
}
