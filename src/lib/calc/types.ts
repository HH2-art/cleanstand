export type QuoteMode = "private" | "public";

/** 공공입찰 모드에서 쓰는 반기별 법정기준값 (regulation_versions 테이블 매핑). */
export interface RegulationVersion {
  effectiveDate: string;
  label: string;
  generalAdminRateCap: number; // %
  profitRateCap: number; // %
  simpleLaborDailyWage: number; // 원 (127. 단순노무종사원 일급)
  foremanDailyWage: number; // 원 (129. 작업반장 일급)
  nationalPensionCompanyRate: number; // %
  healthInsuranceCompanyRate: number; // %
  longTermCareCompanyRate: number; // %
  employmentInsuranceCompanyRate: number; // %
  industrialAccidentRate: number; // %
}

export interface SiteInput {
  areaSqm: number;
  sqmPerHour: number; // 생산성 기준
  frequencyPerWeek: number;
  weeksPerMonth?: number; // default 4.345
}

export interface ExpenseLine {
  name: string;
  amount: number;
}

/**
 * 역할 하나 + 인원수. 작업시간(estimateHours)은 견적 전체에 하나뿐이고 역할별로
 * 갈리지 않는다 — 같은 현장에 여러 역할이 동시에 투입된다고 본다. 인원수는
 * 자동 비율 계산 없이 사용자가 역할별로 직접 입력한다.
 */
export interface PrivateLaborLine {
  roleName: string; // role_standard_rates.role_name (또는 직접입력 라벨)
  workerCount: number;
  hourlyRate: number; // 회사 표준 노동원가 (원/h) — role_standard_rates에서 자동입력되지만 직접 수정 가능
}

export interface PublicLaborLine {
  laborRole: "simple" | "foreman"; // 127 단순노무종사원 vs 129 작업반장
  workerCount: number;
}

/** 일반(민간) 견적 모드 입력. 회사가 자유롭게 설정한 값을 그대로 쓴다. */
export interface PrivateQuoteInput {
  mode: "private";
  site: SiteInput;
  laborLines: PrivateLaborLine[];
  expenses: ExpenseLine[];
  generalAdminRate: number; // %, 회사가 자유 설정
  profitRate: number; // %, 회사가 자유 설정
  vatRate: number; // %
}

/** 공공입찰 원가계산 모드 입력. 노무비 단가와 관리비/이윤율 상한은 regulation에서 온다. */
export interface PublicQuoteInput {
  mode: "public";
  site: SiteInput;
  laborLines: PublicLaborLine[];
  expenses: ExpenseLine[];
  legalCost: number; // 경비 中 보험료(4대보험 회사부담분)+복리후생비+법정부담금 합계
  generalAdminRate: number; // % 회사가 원하는 값 — regulation cap으로 clamp됨
  profitRate: number; // % 회사가 원하는 값 — regulation cap으로 clamp됨
  vatRate: number;
  regulation: RegulationVersion;
}

export type QuoteInput = PrivateQuoteInput | PublicQuoteInput;

export interface QuoteLineItem {
  category: "labor" | "expense" | "admin" | "profit" | "vat" | "other";
  label: string;
  amount: number;
  roleName?: string; // labor 카테고리에서만 채워짐 — 산출내역서 PDF에서 역할별 소계 표시용
  workerCount?: number;
}

export interface QuoteResult {
  estimatedHours: number;
  estimatedWorkers: number; // laborLines의 workerCount 합계
  laborCost: number;
  legalCost: number;
  expenseCost: number;
  adminCost: number;
  profitAmount: number;
  supplyAmount: number; // 공급가액
  vatAmount: number;
  quoteAmount: number; // 최종 견적
  appliedGeneralAdminRate: number; // clamp 적용 후 실제 사용된 비율
  appliedProfitRate: number;
  lineItems: QuoteLineItem[];
}
