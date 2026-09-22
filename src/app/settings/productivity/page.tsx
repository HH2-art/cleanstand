import "@/styles/app-shell.css";
import "./productivity.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import {
  createCustomWorkType,
  renameCustomWorkType,
  resetProductivityRate,
  upsertProductivityOverride,
} from "@/app/actions/productivity";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { KNOWN_WORK_TYPES, workTypeLabel } from "@/lib/workTypeLabels";
import { DeleteCustomWorkTypeButton } from "./DeleteCustomWorkTypeButton";
import { ResetAllButton } from "./ResetAllButton";
import { WorkTypeIcon } from "./WorkTypeIcon";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const ICON = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlusIcon() {
  return (
    <svg {...ICON}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...ICON}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg {...ICON}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export default async function ProductivityPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const [{ data: globalRates }, { data: companyRates }] = await Promise.all([
    supabase.from("productivity_rates").select("work_type, sqm_per_hour").is("company_id", null),
    supabase
      .from("productivity_rates")
      .select("work_type, sqm_per_hour, display_name, updated_at")
      .eq("company_id", company.id),
  ]);

  const knownSet = new Set(KNOWN_WORK_TYPES);
  const globalMap = new Map((globalRates ?? []).map((r) => [r.work_type, r.sqm_per_hour]));
  const companyRows = companyRates ?? [];
  const companyMap = new Map(companyRows.map((r) => [r.work_type, r]));

  const defaultRates = KNOWN_WORK_TYPES.map((workType) => {
    const globalValue = globalMap.get(workType) ?? 0;
    const override = companyMap.get(workType);
    return {
      workType,
      label: workTypeLabel(workType),
      globalValue,
      currentValue: override ? override.sqm_per_hour : globalValue,
      isOverridden: !!override,
    };
  });

  const customRates = companyRows
    .filter((r) => !knownSet.has(r.work_type))
    .map((r) => ({
      workType: r.work_type,
      name: r.display_name ?? r.work_type,
      sqmPerHour: r.sqm_per_hour,
      updatedAt: r.updated_at as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="productivity" companyName={company.name} />
      <div className="main">
        <div className="productivity-page productivity-container">
          <div className="page-head">
            <h1>생산성 기준 설정</h1>
            <p>
              청소 업무별 생산성 기준을 설정할 수 있습니다. 업계 기본값을 참고하거나, 회사의 실제 환경에 맞게
              커스텀할 수 있습니다.
            </p>
          </div>

          {/* 회사 커스텀 */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="section-title-row">
                  <h2>회사 커스텀</h2>
                  <span className="count-badge">{customRates.length}개</span>
                </div>
                <p className="section-note">목록에 없는 청소 항목(예: 카펫청소)을 새로 추가할 때 여기를 써요.</p>
              </div>
              <details>
                <summary className="btn btn-primary">
                  <PlusIcon /> 새 기준 추가
                </summary>
                <form action={createCustomWorkType} className="add-form">
                  <div className="field">
                    <label htmlFor="new_name">이름</label>
                    <input id="new_name" name="new_name" required placeholder="예: 카펫청소" />
                  </div>
                  <div className="field">
                    <label htmlFor="new_sqm_per_hour">생산성 기준 (㎡/시간)</label>
                    <input id="new_sqm_per_hour" name="new_sqm_per_hour" type="number" step="0.01" required />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    추가
                  </button>
                </form>
              </details>
            </div>

            {customRates.length > 0 ? (
              <table className="pt-table">
                <thead>
                  <tr>
                    <th>업무유형</th>
                    <th>생산성 기준 (㎡/시간)</th>
                    <th>최근 수정일</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {customRates.map((rate) => (
                    <tr key={rate.workType}>
                      <td>
                        <div className="wt-row">
                          <span className="wt-icon custom">
                            <WorkTypeIcon workType={rate.workType} />
                          </span>
                          <span className="wt-name">{rate.name}</span>
                        </div>
                      </td>
                      <td>
                        <form action={upsertProductivityOverride} className="rate-input-row">
                          <input type="hidden" name="work_type" value={rate.workType} />
                          <input
                            type="number"
                            name="sqm_per_hour"
                            defaultValue={rate.sqmPerHour}
                            step="0.01"
                            className="rate-input"
                          />
                          <button type="submit" className="btn-text">
                            저장
                          </button>
                        </form>
                      </td>
                      <td className="muted-cell">{formatDateTime(rate.updatedAt)}</td>
                      <td className="actions">
                        <span className="actions-row">
                          <details style={{ display: "inline-block" }}>
                            <summary className="btn-text">수정</summary>
                            <form action={renameCustomWorkType} className="rate-input-row" style={{ marginTop: 8 }}>
                              <input type="hidden" name="work_type" value={rate.workType} />
                              <input type="text" name="new_name" defaultValue={rate.name} className="name-input" />
                              <button type="submit" className="btn-text">
                                저장
                              </button>
                            </form>
                          </details>
                          <DeleteCustomWorkTypeButton workType={rate.workType} name={rate.name} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty-hint">아직 추가한 커스텀 작업유형이 없습니다.</p>
            )}
          </div>

          {/* 업계 기본값 */}
          <div className="card">
            <div className="section-head">
              <div>
                <div className="section-title-row">
                  <h2>업계 기본값</h2>
                  <span className="count-badge">{defaultRates.length}개</span>
                </div>
                <p className="section-note">
                  여기 있는 {defaultRates.length}개 항목은 숫자만 우리 회사에 맞게 바꿀 수 있어요.
                </p>
              </div>
              <ResetAllButton />
            </div>

            <table className="pt-table">
              <thead>
                <tr>
                  <th>업무유형</th>
                  <th className="num">업계 기본값 (㎡/시간)</th>
                  <th className="num">현재 적용값 (㎡/시간)</th>
                  <th>출처</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {defaultRates.map((rate) => (
                  <tr key={rate.workType}>
                    <td>
                      <div className="wt-row">
                        <span className="wt-icon">
                          <WorkTypeIcon workType={rate.workType} />
                        </span>
                        <span className="wt-name">{rate.label}</span>
                      </div>
                    </td>
                    <td className="num muted-cell">{rate.globalValue}</td>
                    <td className="num">
                      {rate.isOverridden ? (
                        <form
                          action={upsertProductivityOverride}
                          className="rate-input-row"
                          style={{ justifyContent: "flex-end" }}
                        >
                          <input type="hidden" name="work_type" value={rate.workType} />
                          <input
                            type="number"
                            name="sqm_per_hour"
                            defaultValue={rate.currentValue}
                            step="0.01"
                            className="rate-input overridden"
                          />
                          <button type="submit" className="btn-text">
                            저장
                          </button>
                        </form>
                      ) : (
                        rate.currentValue
                      )}
                    </td>
                    <td>
                      <span className={`badge ${rate.isOverridden ? "badge-source-custom" : "badge-source-default"}`}>
                        {rate.isOverridden ? "회사 설정값" : "업계 기본값"}
                      </span>
                    </td>
                    <td className="actions">
                      {rate.isOverridden ? (
                        <form action={resetProductivityRate}>
                          <input type="hidden" name="work_type" value={rate.workType} />
                          <button type="submit" className="btn-outline neutral">
                            <ResetIcon /> 기본값으로 되돌리기
                          </button>
                        </form>
                      ) : (
                        <form action={upsertProductivityOverride}>
                          <input type="hidden" name="work_type" value={rate.workType} />
                          <input type="hidden" name="sqm_per_hour" value={rate.globalValue} />
                          <button type="submit" className="btn-outline">
                            <GearIcon /> 회사기준 설정
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="info-banner">
            <InfoIcon />
            <span>여기서 바꾼 기준은 다음에 만드는 새 견적부터 적용돼요. 이미 작성된 견적서는 바뀌지 않아요.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
