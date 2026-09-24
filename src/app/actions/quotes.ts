"use server";

import { redirect } from "next/navigation";
import { requireCurrentCompany, type Company } from "@/lib/company";
import { calculateQuote } from "@/lib/calc/quote";
import type {
  PrivateLaborLine,
  PrivateQuoteInput,
  PublicLaborLine,
  PublicQuoteInput,
  QuoteResult,
  RegulationVersion,
} from "@/lib/calc/types";
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

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * 신뢰 경계: 면적/빈도/역할별 인원수·비율 등 "회사가 자기 견적에 대해 자유롭게 정하는
 * 값"은 클라이언트가 보낸 값을 그대로 쓴다. 반면 생산성기준·경비단가·공공 법정기준값처럼
 * "DB에 저장된 공식 값이어야 하는 것"은 클라이언트가 뭘 보내든 무시하고 항상 서버에서
 * 다시 조회한다 — 최종 저장되는 금액은 항상 이 함수가 새로 계산한 값이다.
 *
 * createQuote/updateQuote가 공유하는 검증+계산 로직 — 새견적 생성 로직은 그대로 두고
 * (동작 100% 동일) 이 부분만 뽑아내서 견적 수정(updateQuote)도 같은 계산엔진을 타게 한다.
 */
async function buildQuoteCalculation(
  supabase: SupabaseClient,
  company: Company,
  payload: QuoteFormPayload,
): Promise<{ error: string } | { regulationVersionId: string | null; result: QuoteResult }> {
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

  return { regulationVersionId, result: calculateQuote(input) };
}

export async function createQuote(payload: QuoteFormPayload): Promise<CreateQuoteResult> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const calc = await buildQuoteCalculation(supabase, company, payload);
  if ("error" in calc) return calc;
  const { regulationVersionId, result } = calc;

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

export type UpdateQuoteResult = { error: string } | { success: true; id: string };

/**
 * 임시저장 견적 수정 — createQuote와 같은 buildQuoteCalculation으로 새 입력값을
 * 재계산해서 기존 row를 insert 대신 update한다. status는 절대 건드리지 않는다(수정
 * 후에도 그대로 "임시저장" — 발송/수주 상태 변경은 updateQuoteStatus가 별도로 담당).
 * "발송완료" 이후 상태의 견적은 숫자가 조용히 바뀌면 안 되므로 여기서도 다시 한번
 * status === "draft"를 확인한다(수정 버튼 자체는 상세 페이지에서 이미 숨기지만, 서버
 * 액션 레벨에서도 막아야 진짜 안전하다).
 */
export async function updateQuote(quoteId: string, payload: QuoteFormPayload): Promise<UpdateQuoteResult> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!existing) return { error: "견적을 찾을 수 없습니다." };
  if (existing.status !== "draft") return { error: "임시저장 상태의 견적만 수정할 수 있습니다." };

  const calc = await buildQuoteCalculation(supabase, company, payload);
  if ("error" in calc) return calc;
  const { regulationVersionId, result } = calc;

  const { error } = await supabase
    .from("quotes")
    .update({
      mode: payload.mode,
      regulation_version_id: regulationVersionId,
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("company_id", company.id);
  if (error) return { error: error.message };

  const { error: deleteError } = await supabase.from("quote_line_items").delete().eq("quote_id", quoteId);
  if (deleteError) return { error: deleteError.message };

  const lineItems = result.lineItems.map((item, index) => ({
    quote_id: quoteId,
    category: item.category,
    label: item.label,
    amount: item.amount,
    sort_order: index,
    role_name: item.roleName ?? null,
    worker_count: item.workerCount ?? null,
  }));
  const { error: lineItemsError } = await supabase.from("quote_line_items").insert(lineItems);
  if (lineItemsError) return { error: lineItemsError.message };

  redirect(`/quotes/${quoteId}`);
}

// src/lib/calc/quote.ts의 DEFAULT_WEEKS_PER_MONTH와 동일(NewQuoteForm.tsx의 WEEKS_PER_MONTH와
// 같은 이유로 여기서도 계산엔진 파일은 건드리지 않고 상수만 그대로 옮겨온다).
const WEEKS_PER_MONTH = 4.345;

export interface QuoteEditData {
  id: string;
  status: string;
  mode: "private" | "public";
  buildingName: string;
  buildingType: string;
  areaSqm: number;
  frequencyPerWeek: number;
  sqmPerHour: number;
  siteConditions: Record<string, unknown>;
  legalCost: number;
  generalAdminRate: number;
  profitRate: number;
  vatRate: number;
  privateLaborLines: { roleName: string; workerCount: number }[];
  publicLaborLines: PublicLaborLine[];
}

/**
 * 견적 수정 화면(/quotes/[id]/edit) 프리필용 데이터. quotes 테이블엔 작업유형
 * (work_type)·실제 적용 비율(%)·선택된 경비항목 ID가 원래 컬럼으로 저장되지 않는다 —
 * 계산 결과 금액만 저장되기 때문. 그래서:
 * - sqmPerHour는 저장된 estimated_hours/area_sqm/frequency_per_week에서
 *   estimateHours 공식의 역함수로 정확히 복원한다(값을 안 바꾸고 그대로 다시 계산에
 *   넣으면 estimated_hours가 그대로 재현된다).
 * - generalAdminRate/profitRate/vatRate도 buildCostBreakdown 공식의 역함수로
 *   저장된 금액에서 정확히 역산한다(공공모드에서 상한 clamp가 적용됐다면 그 clamp된
 *   실제값이 복원된다 — 회사 기본값이 아니라 "그 견적에 실제 적용된 값").
 * - 노무 라인(역할/인원)은 getQuoteForReuse를 그대로 재사용(중복 구현 금지).
 * - 경비항목 선택(expenseItemIds)만은 원래 FK로 저장되지 않아(quote_line_items엔
 *   경비 항목의 그 당시 이름·금액 스냅샷만 남음) 정확히 복원할 수 없다 — 호출자가
 *   빈 선택 상태로 시작한다는 걸 사용자에게 안내해야 한다.
 */
export async function getQuoteForEdit(quoteId: string): Promise<QuoteEditData | null> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, status, mode, building_name, building_type, area_sqm, frequency_per_week, site_conditions, estimated_hours, legal_cost, labor_cost, expense_cost, admin_cost, profit_amount, supply_amount, vat_amount",
    )
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!quote) return null;

  const reuse = await getQuoteForReuse(quoteId);

  const areaSqm = Number(quote.area_sqm);
  const frequencyPerWeek = Number(quote.frequency_per_week);
  const estimatedHours = Number(quote.estimated_hours);
  const sqmPerHour = estimatedHours > 0 ? (areaSqm * frequencyPerWeek * WEEKS_PER_MONTH) / estimatedHours : 0;

  const laborCost = Number(quote.labor_cost);
  const legalCost = Number(quote.legal_cost);
  const expenseCost = Number(quote.expense_cost);
  const adminCost = Number(quote.admin_cost);
  const profitAmount = Number(quote.profit_amount);
  const supplyAmount = Number(quote.supply_amount);
  const vatAmount = Number(quote.vat_amount);

  const adminBase = laborCost + legalCost + expenseCost;
  const profitBase = adminBase + adminCost;
  const generalAdminRate = adminBase > 0 ? (adminCost / adminBase) * 100 : company.general_admin_rate;
  const profitRate = profitBase > 0 ? (profitAmount / profitBase) * 100 : company.profit_rate;
  const vatRate = supplyAmount > 0 ? (vatAmount / supplyAmount) * 100 : company.vat_rate;

  return {
    id: quote.id,
    status: quote.status,
    mode: quote.mode,
    buildingName: quote.building_name ?? "",
    buildingType: quote.building_type ?? "",
    areaSqm,
    frequencyPerWeek,
    sqmPerHour,
    siteConditions: (quote.site_conditions ?? {}) as Record<string, unknown>,
    legalCost,
    generalAdminRate,
    profitRate,
    vatRate,
    privateLaborLines: reuse?.privateLaborLines ?? [],
    publicLaborLines: reuse?.publicLaborLines ?? [],
  };
}

export interface PastQuoteSummary {
  id: string;
  buildingName: string;
  areaSqm: number;
  frequencyPerWeek: number;
  mode: "private" | "public";
  quoteAmount: number;
  createdAt: string;
  roles: string; // "단순노무종사원 2명·작업반장 1명" — quote_line_items(category='labor')에서 조립
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

  const quotes = data ?? [];
  if (quotes.length === 0) return [];

  // quote_line_items.role_name은 public/private 모두 실제 한글 라벨을 그대로 담고 있어
  // (getQuoteForReuse의 REUSE_PUBLIC_ROLE_BY_LABEL 역매핑이 이걸 전제로 한다), 모드
  // 구분 없이 "역할명 N명"을 순서대로 이어붙이면 된다.
  const { data: laborItems } = await supabase
    .from("quote_line_items")
    .select("quote_id, role_name, worker_count, sort_order")
    .in(
      "quote_id",
      quotes.map((q) => q.id),
    )
    .eq("category", "labor")
    .order("sort_order");

  const rolesByQuoteId = new Map<string, string>();
  for (const item of laborItems ?? []) {
    if (!item.role_name || !item.worker_count) continue;
    const entry = `${item.role_name} ${Math.round(Number(item.worker_count))}명`;
    const prev = rolesByQuoteId.get(item.quote_id);
    rolesByQuoteId.set(item.quote_id, prev ? `${prev}·${entry}` : entry);
  }

  return quotes.map((row) => ({
    id: row.id,
    buildingName: row.building_name ?? "-",
    areaSqm: Number(row.area_sqm),
    frequencyPerWeek: row.frequency_per_week,
    mode: row.mode,
    quoteAmount: Number(row.quote_amount),
    createdAt: row.created_at,
    roles: rolesByQuoteId.get(row.id) ?? "",
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
