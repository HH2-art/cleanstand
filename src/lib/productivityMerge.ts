export interface ProductivityRateRow {
  work_type: string;
  sqm_per_hour: number;
  display_name?: string | null;
}

export interface MergedProductivityRate {
  work_type: string;
  sqmPerHour: number;
  isOverridden: boolean;
  displayName: string | null;
}

/**
 * 업계 기본값(global)과 회사 커스텀값(company)을 work_type 기준으로 병합한다.
 * 회사값이 있으면 그 값이 이기지만, 기본값 자체는 DB에서 지워지지 않고 그대로 남는다
 * (company 커스텀 row를 삭제하면 다시 기본값이 보인다).
 */
export function mergeProductivityRates(
  global: ProductivityRateRow[],
  company: ProductivityRateRow[],
): MergedProductivityRate[] {
  const byWorkType = new Map<string, MergedProductivityRate>();

  for (const row of global) {
    byWorkType.set(row.work_type, {
      work_type: row.work_type,
      sqmPerHour: row.sqm_per_hour,
      isOverridden: false,
      displayName: row.display_name ?? null,
    });
  }
  for (const row of company) {
    byWorkType.set(row.work_type, {
      work_type: row.work_type,
      sqmPerHour: row.sqm_per_hour,
      isOverridden: true,
      displayName: row.display_name ?? null,
    });
  }

  return Array.from(byWorkType.values()).sort((a, b) => a.work_type.localeCompare(b.work_type));
}
