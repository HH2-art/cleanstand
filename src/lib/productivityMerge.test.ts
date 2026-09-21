import { describe, expect, it } from "vitest";
import { mergeProductivityRates } from "./productivityMerge";

describe("mergeProductivityRates", () => {
  it("회사 커스텀값이 없으면 업계 기본값을 그대로 쓴다", () => {
    const result = mergeProductivityRates(
      [{ work_type: "office_general", sqm_per_hour: 100 }],
      [],
    );
    expect(result).toEqual([{ work_type: "office_general", sqmPerHour: 100, isOverridden: false, displayName: null }]);
  });

  it("회사 커스텀값이 있으면 기본값 대신 그 값을 쓴다 (기본값 자체는 보존됨)", () => {
    const result = mergeProductivityRates(
      [{ work_type: "office_general", sqm_per_hour: 100 }],
      [{ work_type: "office_general", sqm_per_hour: 130 }],
    );
    expect(result).toEqual([{ work_type: "office_general", sqmPerHour: 130, isOverridden: true, displayName: null }]);
  });

  it("회사가 기본값에 없는 새 작업유형을 추가하면 목록에 포함된다", () => {
    const result = mergeProductivityRates(
      [{ work_type: "office_general", sqm_per_hour: 100 }],
      [{ work_type: "warehouse", sqm_per_hour: 140, display_name: "창고청소" }],
    );
    expect(result).toContainEqual({ work_type: "warehouse", sqmPerHour: 140, isOverridden: true, displayName: "창고청소" });
    expect(result).toHaveLength(2);
  });

  it("work_type 기준으로 정렬해서 반환한다", () => {
    const result = mergeProductivityRates(
      [
        { work_type: "school", sqm_per_hour: 90 },
        { work_type: "factory", sqm_per_hour: 120 },
      ],
      [],
    );
    expect(result.map((r) => r.work_type)).toEqual(["factory", "school"]);
  });
});
