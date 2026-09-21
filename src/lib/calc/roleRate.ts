export interface EmployeeMonthlyCost {
  baseSalary: number;
  annualLeaveAllowance: number;
  retirementProvision: number;
  insuranceBurden: number;
  otherCompanyCost: number;
}

export function totalMonthlyCost(cost: EmployeeMonthlyCost): number {
  return (
    cost.baseSalary +
    cost.annualLeaveAllowance +
    cost.retirementProvision +
    cost.insuranceBurden +
    cost.otherCompanyCost
  );
}

export interface WeightedRateInput {
  monthlyCost: number;
  monthlyWorkHours: number;
}

/**
 * 같은 역할 직원들의 시급원가를 근무시간 가중평균한다.
 * (Σ월원가) ÷ (Σ월근무시간) — 개별 시급을 먼저 구해 다시 가중평균하는 것과
 * 수학적으로 동일하지만 반올림 왕복이 없어 더 정확하다.
 */
export function calculateWeightedHourlyRate(employees: WeightedRateInput[]): number | null {
  if (employees.length === 0) return null;

  const totalHours = employees.reduce((sum, e) => sum + e.monthlyWorkHours, 0);
  if (totalHours <= 0) return null;

  const totalCost = employees.reduce((sum, e) => sum + e.monthlyCost, 0);
  return totalCost / totalHours;
}
