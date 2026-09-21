import { describe, expect, it } from "vitest";
import { renderBreakdownHtml } from "./BreakdownDocument";
import type { PdfQuoteData } from "./types";

function baseQuote(overrides: Partial<PdfQuoteData["quote"]>): PdfQuoteData {
  return {
    company: {
      name: "테스트 회사",
      businessRegistrationNumber: null,
      representativeName: null,
      address: null,
      phone: null,
      logoUrl: null,
    },
    quote: {
      buildingName: "테스트 현장",
      buildingType: "오피스",
      areaSqm: 100,
      frequencyPerWeek: 5,
      mode: "public",
      regulationLabel: null,
      estimatedHours: 8,
      estimatedWorkers: 4,
      laborCost: 760375,
      legalCost: 68434,
      expenseCost: 0,
      adminCost: 82881,
      profitAmount: 91169,
      supplyAmount: 911690,
      vatAmount: 91169,
      quoteAmount: 1002859,
      createdAt: "2026-09-01T00:00:00.000Z",
      ...overrides,
    },
    lineItems: [
      { category: "labor", label: "직접노무비 - 단순노무종사원 (3명)", amount: 570281, roleName: "단순노무종사원", workerCount: 3 },
      { category: "labor", label: "직접노무비 - 작업반장 (1명)", amount: 190094, roleName: "작업반장", workerCount: 1 },
    ],
  };
}

describe("renderBreakdownHtml", () => {
  it("공공 모드에서 regulationLabel이 있으면 적용 기준을 표시한다", () => {
    const html = renderBreakdownHtml(baseQuote({ mode: "public", regulationLabel: "2026년 하반기" }));
    expect(html).toContain("적용 기준");
    expect(html).toContain("2026년 하반기");
  });

  it("regulationLabel이 없으면 적용 기준 행을 생략한다", () => {
    const html = renderBreakdownHtml(baseQuote({ mode: "public", regulationLabel: null }));
    expect(html).not.toContain("적용 기준");
  });

  it("민간 모드에서는 regulationLabel이 있어도 표시하지 않는다", () => {
    const html = renderBreakdownHtml(baseQuote({ mode: "private", regulationLabel: "2026년 하반기" }));
    expect(html).not.toContain("적용 기준");
  });
});
