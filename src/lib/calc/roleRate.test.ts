import { describe, expect, it } from "vitest";
import { calculateWeightedHourlyRate, totalMonthlyCost } from "./roleRate";

describe("totalMonthlyCost", () => {
  it("5개 비용 항목을 합산한다", () => {
    expect(
      totalMonthlyCost({
        baseSalary: 2000000,
        annualLeaveAllowance: 100000,
        retirementProvision: 150000,
        insuranceBurden: 200000,
        otherCompanyCost: 50000,
      }),
    ).toBe(2500000);
  });
});

describe("calculateWeightedHourlyRate", () => {
  it("직원이 1명이면 그 직원의 시급원가를 그대로 반환한다", () => {
    const rate = calculateWeightedHourlyRate([{ monthlyCost: 2090000, monthlyWorkHours: 209 }]);
    expect(rate).toBeCloseTo(10000, 5);
  });

  it("근무시간 가중평균 — 총원가 ÷ 총근무시간과 동일한 결과를 낸다", () => {
    // A: 월200만원/월209h(시급≈9569원), B: 월250만원/월180h(시급≈13889원)
    // 단순평균(11729원)이 아니라 (200만+250만)/(209+180) 가중평균이어야 한다
    const rate = calculateWeightedHourlyRate([
      { monthlyCost: 2000000, monthlyWorkHours: 209 },
      { monthlyCost: 2500000, monthlyWorkHours: 180 },
    ]);
    const expected = (2000000 + 2500000) / (209 + 180);
    expect(rate).toBeCloseTo(expected, 5);
    // 근무시간이 적은 B의 높은 시급 쪽으로 단순평균보다 덜 끌려가야 함(가중치 확인)
    expect(rate).toBeLessThan((2000000 / 209 + 2500000 / 180) / 2);
  });

  it("빈 배열이면 null (계산할 대상이 없음)", () => {
    expect(calculateWeightedHourlyRate([])).toBeNull();
  });

  it("총 근무시간이 0이면 null (0으로 나누기 방지)", () => {
    expect(
      calculateWeightedHourlyRate([{ monthlyCost: 1000000, monthlyWorkHours: 0 }]),
    ).toBeNull();
  });
});
