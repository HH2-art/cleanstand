import { describe, expect, it } from "vitest";
import {
  calculateLaborLineSubtotal,
  calculateQuote,
  clampRate,
  estimateHours,
  estimateWorkers,
  publicHourlyRate,
  sumExpenses,
} from "./quote";
import type { PrivateQuoteInput, PublicQuoteInput, RegulationVersion } from "./types";

const regulation2026H2: RegulationVersion = {
  effectiveDate: "2026-07-01",
  label: "2026년 하반기",
  generalAdminRateCap: 9,
  profitRateCap: 10,
  simpleLaborDailyWage: 95767,
  foremanDailyWage: 147122,
  nationalPensionCompanyRate: 4.75,
  healthInsuranceCompanyRate: 3.595,
  longTermCareCompanyRate: 0.4724,
  employmentInsuranceCompanyRate: 1.15,
  industrialAccidentRate: 0.8,
};

describe("estimateHours", () => {
  it("면적 ÷ 생산성 × 주당횟수 × 월간주수로 월 작업시간을 계산한다", () => {
    // 100㎡ 공간, 생산성 50㎡/h → 세션당 2h, 주 5회 × 4주 = 20세션 → 40h
    const hours = estimateHours(
      { areaSqm: 100, sqmPerHour: 50, frequencyPerWeek: 5, weeksPerMonth: 4 },
    );
    expect(hours).toBeCloseTo(40, 5);
  });

  it("weeksPerMonth 생략 시 4.345를 기본값으로 쓴다", () => {
    const hours = estimateHours({ areaSqm: 100, sqmPerHour: 100, frequencyPerWeek: 5 });
    expect(hours).toBeCloseTo(1 * 5 * 4.345, 5);
  });
});

describe("estimateWorkers", () => {
  it("작업시간을 1인당 월 가능시간으로 나눠 올림한다 (참고용 힌트 — 실제 인원배분과는 별개)", () => {
    expect(estimateWorkers(400, 209)).toBe(2); // 400/209 = 1.91.. -> 2
    expect(estimateWorkers(418, 209)).toBe(2); // 정확히 2배
    expect(estimateWorkers(419, 209)).toBe(3); // 살짝 넘으면 3
  });
});

describe("sumExpenses", () => {
  it("현장경비 항목 리스트를 합산한다", () => {
    expect(
      sumExpenses([
        { name: "청소용품", amount: 300000 },
        { name: "장비", amount: 400000 },
        { name: "운반", amount: 200000 },
      ]),
    ).toBe(900000);
  });

  it("빈 리스트는 0", () => {
    expect(sumExpenses([])).toBe(0);
  });
});

describe("clampRate", () => {
  it("cap 이하 값은 그대로 통과시킨다", () => {
    expect(clampRate(7, 9)).toBe(7);
  });

  it("cap을 넘는 값은 cap으로 clamp한다", () => {
    expect(clampRate(15, 9)).toBe(9);
  });

  it("cap과 정확히 같으면 그대로", () => {
    expect(clampRate(9, 9)).toBe(9);
  });
});

describe("publicHourlyRate", () => {
  it("일급을 8시간으로 나눠 시급을 계산한다 (노임 계산식 기준 8시간)", () => {
    expect(publicHourlyRate(regulation2026H2, "simple")).toBeCloseTo(95767 / 8, 5);
    expect(publicHourlyRate(regulation2026H2, "foreman")).toBeCloseTo(147122 / 8, 5);
  });
});

describe("calculateLaborLineSubtotal", () => {
  it("인원수 × 작업시간 × 시급", () => {
    expect(calculateLaborLineSubtotal(3, 100, 20000)).toBe(3 * 100 * 20000);
  });

  it("인원수 0이면 0", () => {
    expect(calculateLaborLineSubtotal(0, 100, 20000)).toBe(0);
  });
});

describe("calculateQuote — private mode", () => {
  it("사업계획 문서 4장 계산 예시를 그대로 재현한다 (역할 1개, 1명으로 환산)", () => {
    // 오피스 3,000㎡ · 주 5회 · 월 400시간(직접 입력) · 표준노동원가 19,500원/h · 1명
    // 직접노무비 7,800,000 / 현장경비 900,000 / 일반관리비 600,000 / 기업이윤 1,200,000
    // 공급가액 10,500,000 / VAT 1,050,000 / 최종견적 11,550,000
    const input: PrivateQuoteInput = {
      mode: "private",
      // 예시는 월 400h를 직접 준 것이라, area/productivity로는 그 400h가 나오도록 역산해서 넣는다.
      // 세션당 20h(=areaSqm/sqmPerHour) × 주5회 × 4주 = 400h
      site: { areaSqm: 20, sqmPerHour: 1, frequencyPerWeek: 5, weeksPerMonth: 4 },
      laborLines: [{ roleName: "일반청소원", workerCount: 1, hourlyRate: 19500 }],
      expenses: [{ name: "현장경비", amount: 900000 }],
      // 문서 예시는 회사가 자유 설정한 비율이라 액수를 직접 맞추기보다,
      // adminCost/profitAmount가 예시와 같은 금액이 나오도록 rate를 역산한다.
      generalAdminRate: (600000 / (7800000 + 900000)) * 100,
      profitRate: (1200000 / (7800000 + 900000 + 600000)) * 100,
      vatRate: 10,
    };

    const result = calculateQuote(input);

    expect(result.estimatedHours).toBeCloseTo(400, 5);
    expect(result.estimatedWorkers).toBe(1);
    expect(result.laborCost).toBeCloseTo(7800000, 2);
    expect(result.expenseCost).toBeCloseTo(900000, 2);
    expect(result.adminCost).toBeCloseTo(600000, 0);
    expect(result.profitAmount).toBeCloseTo(1200000, 0);
    expect(result.supplyAmount).toBeCloseTo(10500000, 0);
    expect(result.vatAmount).toBeCloseTo(1050000, 0);
    expect(result.quoteAmount).toBeCloseTo(11550000, 0);
  });

  it("역할이 여러 개면 (인원수 × 작업시간 × 시급)을 역할별로 계산해 합산한다", () => {
    // 일반청소원 3명 @19,500원/h + 반장 1명 @25,000원/h, 작업시간 100h
    const input: PrivateQuoteInput = {
      mode: "private",
      site: { areaSqm: 5, sqmPerHour: 1, frequencyPerWeek: 5, weeksPerMonth: 4 }, // -> 100h
      laborLines: [
        { roleName: "일반청소원", workerCount: 3, hourlyRate: 19500 },
        { roleName: "반장", workerCount: 1, hourlyRate: 25000 },
      ],
      expenses: [],
      generalAdminRate: 0,
      profitRate: 0,
      vatRate: 0,
    };

    const result = calculateQuote(input);

    expect(result.estimatedHours).toBeCloseTo(100, 5);
    expect(result.estimatedWorkers).toBe(4); // 3 + 1
    const expectedLabor = 3 * 100 * 19500 + 1 * 100 * 25000;
    expect(result.laborCost).toBeCloseTo(expectedLabor, 2);

    const laborItems = result.lineItems.filter((item) => item.category === "labor");
    expect(laborItems).toHaveLength(2);
    expect(laborItems.find((item) => item.roleName === "일반청소원")).toMatchObject({
      workerCount: 3,
      amount: 3 * 100 * 19500,
    });
    expect(laborItems.find((item) => item.roleName === "반장")).toMatchObject({
      workerCount: 1,
      amount: 1 * 100 * 25000,
    });
  });

  it("private 모드는 회사가 설정한 비율을 clamp 없이 그대로 쓴다", () => {
    const input: PrivateQuoteInput = {
      mode: "private",
      site: { areaSqm: 100, sqmPerHour: 100, frequencyPerWeek: 5, weeksPerMonth: 4 },
      laborLines: [{ roleName: "일반청소원", workerCount: 1, hourlyRate: 20000 }],
      expenses: [],
      generalAdminRate: 25, // 공공 상한(9%)보다 훨씬 높음 — private는 그대로 허용
      profitRate: 30,
      vatRate: 10,
    };

    const result = calculateQuote(input);
    expect(result.appliedGeneralAdminRate).toBe(25);
    expect(result.appliedProfitRate).toBe(30);
  });
});

describe("calculateQuote — public mode", () => {
  it("regulation의 법정 노무비 단가를 사용하고, 관리비/이윤율은 상한으로 clamp한다", () => {
    const input: PublicQuoteInput = {
      mode: "public",
      site: { areaSqm: 100, sqmPerHour: 100, frequencyPerWeek: 5, weeksPerMonth: 4 },
      laborLines: [{ laborRole: "simple", workerCount: 1 }],
      expenses: [{ name: "청소용품", amount: 100000 }],
      legalCost: 200000,
      generalAdminRate: 20, // 상한(9%)을 초과 — clamp되어야 함
      profitRate: 15, // 상한(10%)을 초과 — clamp되어야 함
      vatRate: 10,
      regulation: regulation2026H2,
    };

    const result = calculateQuote(input);

    expect(result.appliedGeneralAdminRate).toBe(9);
    expect(result.appliedProfitRate).toBe(10);
    expect(result.laborCost).toBeCloseTo(20 * (95767 / 8), 2); // estimatedHours=1*5*4=20h, 1명
    expect(result.legalCost).toBe(200000);

    const adminBase = result.laborCost + result.legalCost + result.expenseCost;
    expect(result.adminCost).toBeCloseTo(adminBase * 0.09, 2);
    const profitBase = adminBase + result.adminCost;
    expect(result.profitAmount).toBeCloseTo(profitBase * 0.1, 2);
    expect(result.supplyAmount).toBeCloseTo(
      result.laborCost + result.legalCost + result.expenseCost + result.adminCost + result.profitAmount,
      2,
    );
    expect(result.vatAmount).toBeCloseTo(result.supplyAmount * 0.1, 2);
    expect(result.quoteAmount).toBeCloseTo(result.supplyAmount + result.vatAmount, 2);
  });

  it("foreman(작업반장) 노임을 선택하면 더 높은 일급이 적용된다", () => {
    const base: Omit<PublicQuoteInput, "laborLines"> = {
      mode: "public",
      site: { areaSqm: 100, sqmPerHour: 100, frequencyPerWeek: 5, weeksPerMonth: 4 },
      expenses: [],
      legalCost: 0,
      generalAdminRate: 9,
      profitRate: 10,
      vatRate: 10,
      regulation: regulation2026H2,
    };

    const simple = calculateQuote({ ...base, laborLines: [{ laborRole: "simple", workerCount: 1 }] });
    const foreman = calculateQuote({ ...base, laborLines: [{ laborRole: "foreman", workerCount: 1 }] });

    expect(foreman.laborCost).toBeGreaterThan(simple.laborCost);
  });

  it("단순노무종사원 + 작업반장을 함께 배치하면 각자 법정 노임으로 계산해 합산한다", () => {
    const input: PublicQuoteInput = {
      mode: "public",
      site: { areaSqm: 100, sqmPerHour: 100, frequencyPerWeek: 5, weeksPerMonth: 4 }, // -> 20h
      laborLines: [
        { laborRole: "simple", workerCount: 3 },
        { laborRole: "foreman", workerCount: 1 },
      ],
      expenses: [],
      legalCost: 0,
      generalAdminRate: 9,
      profitRate: 10,
      vatRate: 10,
      regulation: regulation2026H2,
    };

    const result = calculateQuote(input);
    const hours = 20;
    const expectedLabor = 3 * hours * (95767 / 8) + 1 * hours * (147122 / 8);
    expect(result.laborCost).toBeCloseTo(expectedLabor, 2);
    expect(result.estimatedWorkers).toBe(4);

    const laborItems = result.lineItems.filter((item) => item.category === "labor");
    expect(laborItems).toHaveLength(2);
    expect(laborItems.map((item) => item.roleName).sort()).toEqual(["단순노무종사원", "작업반장"].sort());
  });

  it("lineItems에 노무비/경비/관리비/이윤/VAT 항목이 모두 포함된다 (도급노동자 보호지침 요구사항)", () => {
    const input: PublicQuoteInput = {
      mode: "public",
      site: { areaSqm: 100, sqmPerHour: 100, frequencyPerWeek: 5, weeksPerMonth: 4 },
      laborLines: [{ laborRole: "simple", workerCount: 1 }],
      expenses: [{ name: "청소용품", amount: 50000 }],
      legalCost: 100000,
      generalAdminRate: 9,
      profitRate: 10,
      vatRate: 10,
      regulation: regulation2026H2,
    };

    const result = calculateQuote(input);
    const categories = result.lineItems.map((item) => item.category);
    expect(categories).toContain("labor");
    expect(categories).toContain("expense");
    expect(categories).toContain("admin");
    expect(categories).toContain("profit");
    expect(categories).toContain("vat");
  });
});
