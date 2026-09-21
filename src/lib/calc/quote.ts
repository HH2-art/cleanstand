import type {
  ExpenseLine,
  PrivateLaborLine,
  PrivateQuoteInput,
  PublicLaborLine,
  PublicQuoteInput,
  QuoteInput,
  QuoteLineItem,
  QuoteResult,
  RegulationVersion,
  SiteInput,
} from "./types";

const DEFAULT_WEEKS_PER_MONTH = 4.345;

/** 현장정보 → 예상 작업시간 (월 기준). 견적 전체에 하나뿐이고 역할별로 갈리지 않는다. */
export function estimateHours(site: SiteInput): number {
  const weeksPerMonth = site.weeksPerMonth ?? DEFAULT_WEEKS_PER_MONTH;
  const hoursPerSession = site.areaSqm / site.sqmPerHour;
  const sessionsPerMonth = site.frequencyPerWeek * weeksPerMonth;
  return hoursPerSession * sessionsPerMonth;
}

/**
 * 참고용 추정 총인원 (작업시간 ÷ 1인당 월 투입 가능시간, 올림). 실제 인원 배분은
 * 자동 비율 계산 없이 역할별로 사용자가 직접 입력한다(laborLines) — 이 함수는
 * UI에서 "대략 몇 명 필요할지" 힌트를 보여주는 용도로만 쓰인다.
 */
export function estimateWorkers(hours: number, monthlyHoursPerWorker: number): number {
  return Math.ceil(hours / monthlyHoursPerWorker);
}

export function sumExpenses(expenses: ExpenseLine[]): number {
  return expenses.reduce((total, item) => total + item.amount, 0);
}

/** 공공입찰 모드의 법정 상한 clamp. */
export function clampRate(rate: number, cap: number): number {
  return Math.min(rate, cap);
}

/** 일급 ÷ 8시간 = 시급 (노임 계산식: (기본급+통상적수당)÷총정상근로시간×8시간 기준). */
export function publicHourlyRate(
  regulation: RegulationVersion,
  role: "simple" | "foreman",
): number {
  const dailyWage = role === "simple" ? regulation.simpleLaborDailyWage : regulation.foremanDailyWage;
  return dailyWage / 8;
}

/** 역할 1행의 노무비 소계 = 인원수 × 작업시간 × 시급. */
export function calculateLaborLineSubtotal(workerCount: number, hours: number, hourlyRate: number): number {
  return workerCount * hours * hourlyRate;
}

interface ResolvedLaborLine {
  roleName: string;
  workerCount: number;
  hourlyRate: number;
  subtotal: number;
}

function resolvePrivateLaborLines(hours: number, lines: PrivateLaborLine[]): ResolvedLaborLine[] {
  return lines.map((line) => ({
    roleName: line.roleName,
    workerCount: line.workerCount,
    hourlyRate: line.hourlyRate,
    subtotal: calculateLaborLineSubtotal(line.workerCount, hours, line.hourlyRate),
  }));
}

const PUBLIC_ROLE_LABELS: Record<PublicLaborLine["laborRole"], string> = {
  simple: "단순노무종사원",
  foreman: "작업반장",
};

function resolvePublicLaborLines(
  hours: number,
  lines: PublicLaborLine[],
  regulation: RegulationVersion,
): ResolvedLaborLine[] {
  return lines.map((line) => {
    const hourlyRate = publicHourlyRate(regulation, line.laborRole);
    return {
      roleName: PUBLIC_ROLE_LABELS[line.laborRole],
      workerCount: line.workerCount,
      hourlyRate,
      subtotal: calculateLaborLineSubtotal(line.workerCount, hours, hourlyRate),
    };
  });
}

interface CostBreakdown {
  laborCost: number;
  legalCost: number;
  expenseCost: number;
  adminCost: number;
  profitAmount: number;
  supplyAmount: number;
  vatAmount: number;
  quoteAmount: number;
}

/**
 * 노무비/경비 → 일반관리비 → 기업이윤 → 공급가액 → VAT → 최종견적.
 * 관리비 base = 노무비+법정비용+경비, 이윤 base = 관리비 base + 관리비
 * (원가계산서 5단 구조: 노무비/경비/일반관리비/이윤, 용역은 재료비 제외).
 */
function buildCostBreakdown(params: {
  laborCost: number;
  legalCost: number;
  expenseCost: number;
  generalAdminRate: number;
  profitRate: number;
  vatRate: number;
}): CostBreakdown {
  const { laborCost, legalCost, expenseCost, generalAdminRate, profitRate, vatRate } = params;
  const adminBase = laborCost + legalCost + expenseCost;
  const adminCost = adminBase * (generalAdminRate / 100);
  const profitBase = adminBase + adminCost;
  const profitAmount = profitBase * (profitRate / 100);
  const supplyAmount = laborCost + legalCost + expenseCost + adminCost + profitAmount;
  const vatAmount = supplyAmount * (vatRate / 100);
  const quoteAmount = supplyAmount + vatAmount;

  return { laborCost, legalCost, expenseCost, adminCost, profitAmount, supplyAmount, vatAmount, quoteAmount };
}

function buildLineItems(laborLines: ResolvedLaborLine[], breakdown: CostBreakdown): QuoteLineItem[] {
  const laborItems: QuoteLineItem[] = laborLines.map((line) => ({
    category: "labor",
    label: `직접노무비 - ${line.roleName} (${line.workerCount}명)`,
    amount: line.subtotal,
    roleName: line.roleName,
    workerCount: line.workerCount,
  }));

  return [
    ...laborItems,
    ...(breakdown.legalCost > 0
      ? [{ category: "other" as const, label: "법정비용", amount: breakdown.legalCost }]
      : []),
    { category: "expense", label: "현장경비", amount: breakdown.expenseCost },
    { category: "admin", label: "일반관리비", amount: breakdown.adminCost },
    { category: "profit", label: "기업이윤", amount: breakdown.profitAmount },
    { category: "vat", label: "VAT", amount: breakdown.vatAmount },
  ];
}

function calculatePrivateQuote(input: PrivateQuoteInput): QuoteResult {
  const hours = estimateHours(input.site);
  const resolvedLines = resolvePrivateLaborLines(hours, input.laborLines);
  const laborCost = resolvedLines.reduce((sum, line) => sum + line.subtotal, 0);
  const workers = resolvedLines.reduce((sum, line) => sum + line.workerCount, 0);
  const expenseCost = sumExpenses(input.expenses);

  const breakdown = buildCostBreakdown({
    laborCost,
    legalCost: 0,
    expenseCost,
    generalAdminRate: input.generalAdminRate,
    profitRate: input.profitRate,
    vatRate: input.vatRate,
  });

  return {
    estimatedHours: hours,
    estimatedWorkers: workers,
    ...breakdown,
    appliedGeneralAdminRate: input.generalAdminRate,
    appliedProfitRate: input.profitRate,
    lineItems: buildLineItems(resolvedLines, breakdown),
  };
}

function calculatePublicQuote(input: PublicQuoteInput): QuoteResult {
  const hours = estimateHours(input.site);
  const resolvedLines = resolvePublicLaborLines(hours, input.laborLines, input.regulation);
  const laborCost = resolvedLines.reduce((sum, line) => sum + line.subtotal, 0);
  const workers = resolvedLines.reduce((sum, line) => sum + line.workerCount, 0);
  const expenseCost = sumExpenses(input.expenses);

  const appliedGeneralAdminRate = clampRate(input.generalAdminRate, input.regulation.generalAdminRateCap);
  const appliedProfitRate = clampRate(input.profitRate, input.regulation.profitRateCap);

  const breakdown = buildCostBreakdown({
    laborCost,
    legalCost: input.legalCost,
    expenseCost,
    generalAdminRate: appliedGeneralAdminRate,
    profitRate: appliedProfitRate,
    vatRate: input.vatRate,
  });

  return {
    estimatedHours: hours,
    estimatedWorkers: workers,
    ...breakdown,
    appliedGeneralAdminRate,
    appliedProfitRate,
    lineItems: buildLineItems(resolvedLines, breakdown),
  };
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  return input.mode === "private" ? calculatePrivateQuote(input) : calculatePublicQuote(input);
}
