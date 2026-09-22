"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createQuote,
  getQuoteForReuse,
  listPastQuotesByBuildingType,
  type PastQuoteSummary,
  type QuoteFormPayload,
} from "@/app/actions/quotes";
import { calculateQuote, estimateHours, estimateWorkers, publicHourlyRate } from "@/lib/calc/quote";
import type { PrivateLaborLine, PrivateQuoteInput, PublicLaborLine, PublicQuoteInput, RegulationVersion } from "@/lib/calc/types";
import { workTypeLabel } from "@/lib/workTypeLabels";

const BUILDING_TYPES = ["오피스", "병원", "공장", "학교", "상가", "기타"];
// src/lib/calc/quote.ts의 DEFAULT_WEEKS_PER_MONTH와 동일 — "월" 단위 빈도 입력을 주 단위로 환산할 때만 쓴다.
const WEEKS_PER_MONTH = 4.345;
const MONTHLY_HOURS_PER_WORKER = 209;

const ACTIVE_TOGGLE_STYLE = { background: "var(--surface)", color: "var(--brand)", boxShadow: "var(--shadow-sm)" };
const ACTIVE_PILL_STYLE = { background: "var(--brand-subtle)", color: "var(--brand)", fontWeight: 600 };

interface RoleRate {
  role_name: string;
  standard_hourly_rate: number;
}
interface ProductivityRate {
  work_type: string;
  sqmPerHour: number;
  isOverridden: boolean;
  displayName: string | null;
}
interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  unit_cost: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  supplies: "청소용품",
  equipment: "장비",
  uniform: "피복",
  transport: "운반",
  other: "기타",
};
const CATEGORY_ORDER = ["supplies", "equipment", "uniform", "transport", "other"];

let rowIdSeq = 0;
function nextRowId() {
  rowIdSeq += 1;
  return rowIdSeq;
}

interface PrivateLaborRow extends PrivateLaborLine {
  id: number;
}
interface PublicLaborRow extends PublicLaborLine {
  id: number;
}

function won(amount: number) {
  return `${Math.round(amount).toLocaleString()}원`;
}

export function NewQuoteForm({
  company,
  roleRates,
  productivityRates,
  expenseItems,
  regulation,
}: {
  company: { name: string; generalAdminRate: number; profitRate: number; vatRate: number };
  roleRates: RoleRate[];
  productivityRates: ProductivityRate[];
  expenseItems: ExpenseItem[];
  regulation: RegulationVersion | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 현장정보
  const [mode, setMode] = useState<"private" | "public">("private");
  const [buildingName, setBuildingName] = useState("");
  const [buildingType, setBuildingType] = useState(BUILDING_TYPES[0]);
  const [workType, setWorkType] = useState(productivityRates[0]?.work_type ?? "");
  // 작업유형 선택 시 프리필되지만, 현장마다 직접 조정할 수 있다(예전엔 고정값이었음).
  const [sqmPerHour, setSqmPerHour] = useState<number>(() => productivityRates[0]?.sqmPerHour ?? 0);
  const [areaSqm, setAreaSqm] = useState<number | "">("");
  const [frequencyPerWeek, setFrequencyPerWeek] = useState<number | "">(5);
  const [freqUnit, setFreqUnit] = useState<"week" | "month">("week");

  // 부가 작업 태그 — 참고용, 계산에는 반영되지 않는다(실제 작업유형 목록을 그대로 재사용하되
  // 저장 payload에는 포함하지 않는다 — 지난 세션에 같은 이유로 비슷한 "primary/pin" 방식을
  // 되돌린 적이 있어, 계산에 안 쓰인다는 걸 라벨로 항상 명시한다).
  const [selectedTagKeys, setSelectedTagKeys] = useState<string[]>([]);
  const [customTagOpen, setCustomTagOpen] = useState(false);
  const [customTagText, setCustomTagText] = useState("");

  // site_conditions — 계산엔 안 쓰이는 참고용 현장 맥락 정보
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [contaminationLevel, setContaminationLevel] = useState("보통");
  const [restroomCount, setRestroomCount] = useState<number | "">("");
  const [stairFloors, setStairFloors] = useState<number | "">("");
  const [floorMaterial, setFloorMaterial] = useState("");
  const [parking, setParking] = useState("");
  const [furnitureDensity, setFurnitureDensity] = useState("보통");
  const [notes, setNotes] = useState("");

  // 역할별 인원 — 작업시간은 견적 전체에 하나, 역할별로 인원수만 다르게 직접 입력한다.
  const [privateLaborRows, setPrivateLaborRows] = useState<PrivateLaborRow[]>(() =>
    roleRates.length > 0
      ? [{ id: nextRowId(), roleName: roleRates[0].role_name, workerCount: 1, hourlyRate: roleRates[0].standard_hourly_rate }]
      : [{ id: nextRowId(), roleName: "", workerCount: 1, hourlyRate: 0 }],
  );
  const [publicLaborRows, setPublicLaborRows] = useState<PublicLaborRow[]>([
    { id: nextRowId(), laborRole: "simple", workerCount: 1 },
  ]);

  const [legalCost, setLegalCost] = useState<number>(0);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const [generalAdminRate, setGeneralAdminRate] = useState(company.generalAdminRate);
  const [profitRate, setProfitRate] = useState(company.profitRate);
  const [vatRate, setVatRate] = useState(company.vatRate);

  // 지난 견적 참고 — 같은 건물유형의 최근 견적을 새 견적의 출발점으로 불러올 수 있다.
  const [pastQuotes, setPastQuotes] = useState<PastQuoteSummary[]>([]);
  const [reusingId, setReusingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPastQuotesByBuildingType(buildingType).then((rows) => {
      if (!cancelled) setPastQuotes(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [buildingType]);

  function handleReuse(id: string) {
    setReusingId(id);
    startTransition(async () => {
      const data = await getQuoteForReuse(id);
      if (data) {
        setMode(data.mode);
        setAreaSqm(data.areaSqm);
        setFrequencyPerWeek(data.frequencyPerWeek);
        setFreqUnit("week");
        if (data.mode === "private" && data.privateLaborLines.length > 0) {
          setPrivateLaborRows(
            data.privateLaborLines.map((line) => ({
              id: nextRowId(),
              roleName: line.roleName,
              workerCount: line.workerCount,
              hourlyRate: roleRates.find((r) => r.role_name === line.roleName)?.standard_hourly_rate ?? 0,
            })),
          );
        } else if (data.mode === "public" && data.publicLaborLines.length > 0) {
          setPublicLaborRows(data.publicLaborLines.map((line) => ({ id: nextRowId(), ...line })));
        }
      }
      setReusingId(null);
    });
  }

  function toggleTag(key: string) {
    setSelectedTagKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const selectedProductivity = productivityRates.find((r) => r.work_type === workType);
  const selectedExpenses = expenseItems
    .filter((item) => selectedExpenseIds.has(item.id))
    .map((item) => ({ name: item.name, amount: item.unit_cost }));

  const numericAreaSqm = typeof areaSqm === "number" ? areaSqm : 0;
  const rawFrequency = typeof frequencyPerWeek === "number" ? frequencyPerWeek : 0;
  const numericFrequency = freqUnit === "week" ? rawFrequency : rawFrequency / WEEKS_PER_MONTH;

  const hoursHint = useMemo(() => {
    if (!sqmPerHour || numericAreaSqm <= 0 || numericFrequency <= 0) return null;
    return estimateHours({ areaSqm: numericAreaSqm, sqmPerHour, frequencyPerWeek: numericFrequency });
  }, [sqmPerHour, numericAreaSqm, numericFrequency]);

  const workersHint = hoursHint !== null ? estimateWorkers(hoursHint, MONTHLY_HOURS_PER_WORKER) : null;

  // 실시간 계산 미리보기 — 계산엔진은 순수함수라 클라이언트에서 바로 돌려도 안전하다.
  // (저장 시점에는 서버가 생산성/경비/법정기준값을 DB에서 다시 조회해 재계산한다.)
  const preview = useMemo(() => {
    if (!sqmPerHour || numericAreaSqm <= 0 || numericFrequency <= 0) return null;

    const site = { areaSqm: numericAreaSqm, sqmPerHour, frequencyPerWeek: numericFrequency };

    if (mode === "private") {
      const laborLines = privateLaborRows.filter((row) => row.workerCount > 0 && row.hourlyRate > 0);
      if (laborLines.length === 0) return null;
      const input: PrivateQuoteInput = {
        mode: "private",
        site,
        laborLines,
        expenses: selectedExpenses,
        generalAdminRate,
        profitRate,
        vatRate,
      };
      return calculateQuote(input);
    }

    if (!regulation) return null;
    const laborLines = publicLaborRows.filter((row) => row.workerCount > 0);
    if (laborLines.length === 0) return null;
    const input: PublicQuoteInput = {
      mode: "public",
      site,
      laborLines,
      expenses: selectedExpenses,
      legalCost,
      generalAdminRate,
      profitRate,
      vatRate,
      regulation,
    };
    return calculateQuote(input);
  }, [
    mode,
    sqmPerHour,
    numericAreaSqm,
    numericFrequency,
    privateLaborRows,
    publicLaborRows,
    selectedExpenses,
    generalAdminRate,
    profitRate,
    vatRate,
    legalCost,
    regulation,
  ]);

  // 공공모드 법정비용 추천값: 예상 노무비 × regulation 4대보험 회사부담 합계.
  const suggestedLegalCost = useMemo(() => {
    if (!regulation || !preview) return null;
    const insuranceRateSum =
      regulation.nationalPensionCompanyRate +
      regulation.healthInsuranceCompanyRate +
      regulation.longTermCareCompanyRate +
      regulation.employmentInsuranceCompanyRate +
      regulation.industrialAccidentRate;
    return preview.laborCost * (insuranceRateSum / 100);
  }, [regulation, preview]);

  function toggleExpense(id: string) {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPrivateRow() {
    setPrivateLaborRows((rows) => [...rows, { id: nextRowId(), roleName: "", workerCount: 1, hourlyRate: 0 }]);
  }
  function removePrivateRow(id: number) {
    setPrivateLaborRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }
  function updatePrivateRow(id: number, patch: Partial<PrivateLaborRow>) {
    setPrivateLaborRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addPublicRow() {
    setPublicLaborRows((rows) => [...rows, { id: nextRowId(), laborRole: "simple", workerCount: 1 }]);
  }
  function removePublicRow(id: number) {
    setPublicLaborRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }
  function updatePublicRow(id: number, patch: Partial<PublicLaborRow>) {
    setPublicLaborRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    setError(null);
    const payload: QuoteFormPayload = {
      mode,
      buildingName,
      buildingType,
      workType,
      areaSqm: numericAreaSqm,
      frequencyPerWeek: numericFrequency,
      siteConditions: {
        contamination_level: contaminationLevel,
        restroom_count: restroomCount === "" ? null : restroomCount,
        stair_floors: stairFloors === "" ? null : stairFloors,
        floor_material: floorMaterial || null,
        parking: parking || null,
        furniture_density: furnitureDensity,
        notes: notes || null,
      },
      privateLaborLines: privateLaborRows.map(({ roleName, workerCount, hourlyRate }) => ({ roleName, workerCount, hourlyRate })),
      publicLaborLines: publicLaborRows.map(({ laborRole, workerCount }) => ({ laborRole, workerCount })),
      legalCost,
      expenseItemIds: Array.from(selectedExpenseIds),
      generalAdminRate,
      profitRate,
      vatRate,
    };

    startTransition(async () => {
      const result = await createQuote(payload);
      if (result && "error" in result) setError(result.error);
    });
  }

  const selectedWorkTypeLabel = selectedProductivity ? workTypeLabel(selectedProductivity.work_type, selectedProductivity.displayName) : "";

  return (
    <>
      <div className="topbar">
        <h1>새 견적 만들기</h1>
        <p>{company.name}</p>
      </div>

      <div className="page">
        <div className="col-form">
          {/* 1. 모드 선택 */}
          <div className="card">
            <div className="card-head">
              <h2>모드</h2>
              <span className="step">1</span>
            </div>
            <div className="mode-toggle">
              <button type="button" onClick={() => setMode("private")} style={mode === "private" ? ACTIVE_TOGGLE_STYLE : undefined}>
                일반 견적 (민간)
              </button>
              <button
                type="button"
                onClick={() => setMode("public")}
                disabled={!regulation}
                style={mode === "public" ? ACTIVE_TOGGLE_STYLE : undefined}
              >
                공공입찰 원가계산{!regulation && " (법정기준값 없음)"}
              </button>
            </div>
          </div>

          {/* 2. 현장정보 */}
          <div className="card">
            <div className="card-head">
              <h2>현장정보</h2>
              <span className="step">2</span>
            </div>
            <div className="field-grid">
              <div className="field">
                <label>
                  현장명 <span className="req">*</span>
                </label>
                <input type="text" value={buildingName} onChange={(e) => setBuildingName(e.target.value)} />
              </div>
              <div className="field">
                <label>건물유형</label>
                <select value={buildingType} onChange={(e) => setBuildingType(e.target.value)}>
                  {BUILDING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-grid" style={{ marginTop: 16 }}>
              <div className="field">
                <label>
                  청소범위 (작업유형) <span className="req">*</span>
                </label>
                <select
                  value={workType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWorkType(val);
                    const def = productivityRates.find((r) => r.work_type === val);
                    if (def) setSqmPerHour(def.sqmPerHour);
                  }}
                >
                  {productivityRates.map((r) => (
                    <option key={r.work_type} value={r.work_type}>
                      {workTypeLabel(r.work_type, r.displayName)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>작업속도 ({selectedWorkTypeLabel} 기준 프리필, 수정 가능)</label>
                <div className="unit-suffix">
                  <input type="number" value={sqmPerHour} onChange={(e) => setSqmPerHour(Number(e.target.value) || 0)} />
                  <span>㎡ / 인시간</span>
                </div>
              </div>
            </div>

            <div className="field-grid" style={{ marginTop: 16 }}>
              <div className="field">
                <label>
                  면적 <span className="req">*</span>
                </label>
                <div className="unit-suffix">
                  <input
                    type="number"
                    value={areaSqm}
                    onChange={(e) => setAreaSqm(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <span>㎡</span>
                </div>
              </div>
              <div className="field">
                <label>
                  빈도 <span className="req">*</span>
                </label>
                <div className="freq-row">
                  <input
                    type="number"
                    value={frequencyPerWeek}
                    onChange={(e) => setFrequencyPerWeek(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  <div className="unit-toggle">
                    <button type="button" className={freqUnit === "week" ? "active" : ""} onClick={() => setFreqUnit("week")}>
                      주
                    </button>
                    <button type="button" className={freqUnit === "month" ? "active" : ""} onClick={() => setFreqUnit("month")}>
                      월
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="field" style={{ marginTop: 16 }}>
              <label>
                부가 작업 태그 <span className="tag-info" style={{ marginLeft: 4 }}>참고용 · 계산 미반영</span>
              </label>
              <div className="chip-row">
                {productivityRates.map((r) => {
                  const selected = selectedTagKeys.includes(r.work_type);
                  return (
                    <span key={r.work_type} className={`chip ${selected ? "selected" : ""}`} onClick={() => toggleTag(r.work_type)}>
                      {workTypeLabel(r.work_type, r.displayName)}
                    </span>
                  );
                })}
                <span className={`chip ${customTagOpen ? "selected" : ""}`} onClick={() => setCustomTagOpen((v) => !v)}>
                  + 기타
                </span>
              </div>
              {customTagOpen && (
                <div className="chip-custom-input">
                  <input
                    type="text"
                    value={customTagText}
                    onChange={(e) => setCustomTagText(e.target.value)}
                    placeholder="예: 소독 방역, 카펫 청소 등"
                  />
                </div>
              )}
            </div>

            {pastQuotes.length > 0 && (
              <div className="past-banner">
                <div className="past-banner-head">
                  <span className="t">지난 견적 참고</span>
                  <span className="c">
                    {buildingType} 유형 최근 {pastQuotes.length}건
                  </span>
                </div>
                <div className="past-cards">
                  {pastQuotes.map((q) => (
                    <div key={q.id} className="past-card">
                      <div className="name">{q.buildingName}</div>
                      <div className="meta">
                        {q.areaSqm.toLocaleString()}㎡ · 주 {q.frequencyPerWeek}회 ·{" "}
                        {q.roles || (q.mode === "private" ? "일반" : "공공입찰")}
                      </div>
                      <div className="amount num">{won(q.quoteAmount)}</div>
                      <button type="button" onClick={() => handleReuse(q.id)} disabled={reusingId === q.id}>
                        {reusingId === q.id ? "불러오는 중..." : "이 구성으로 시작하기"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hoursHint !== null && (
              <div className="hint-line">
                예상 작업시간 <b>{hoursHint.toFixed(1)}h</b> · 추천 인원 약 <b>{workersHint}명</b>
              </div>
            )}
          </div>

          {/* 3. 노동원가 */}
          <div className="card">
            <div className="card-head">
              <h2>노동원가 — 역할별 인원</h2>
              <span className="step">3</span>
            </div>

            {mode === "private" ? (
              <>
                <div className="role-rows">
                  {privateLaborRows.map((row) => {
                    const isKnownRole = roleRates.some((r) => r.role_name === row.roleName);
                    return (
                      <div key={row.id} className="role-row">
                        <div className="field">
                          <label>역할</label>
                          <div className="role-pill">
                            {roleRates.map((r) => (
                              <button
                                key={r.role_name}
                                type="button"
                                style={isKnownRole && row.roleName === r.role_name ? ACTIVE_PILL_STYLE : undefined}
                                onClick={() => updatePrivateRow(row.id, { roleName: r.role_name, hourlyRate: r.standard_hourly_rate })}
                              >
                                {r.role_name}
                              </button>
                            ))}
                            <button
                              type="button"
                              style={!isKnownRole ? ACTIVE_PILL_STYLE : undefined}
                              onClick={() => updatePrivateRow(row.id, { roleName: "" })}
                            >
                              직접 입력
                            </button>
                          </div>
                        </div>
                        {!isKnownRole && (
                          <div className="field">
                            <label>역할명</label>
                            <input
                              type="text"
                              value={row.roleName}
                              onChange={(e) => updatePrivateRow(row.id, { roleName: e.target.value })}
                              placeholder="예: 일반청소원, 반장"
                            />
                          </div>
                        )}
                        <div className="field qty">
                          <label>인원수</label>
                          <input
                            type="number"
                            value={row.workerCount}
                            onChange={(e) => updatePrivateRow(row.id, { workerCount: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="field rate">
                          <label>시급원가 (원/h)</label>
                          <input
                            type="number"
                            value={row.hourlyRate}
                            onChange={(e) => updatePrivateRow(row.id, { hourlyRate: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <button
                          type="button"
                          className="row-remove"
                          onClick={() => removePrivateRow(row.id)}
                          disabled={privateLaborRows.length === 1}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                {roleRates.length === 0 && (
                  <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                    아직 등록된 직원이 없습니다 — 역할명과 시급원가를 직접 입력해주세요.
                  </p>
                )}
                <button type="button" className="add-row-btn" onClick={addPrivateRow} style={{ marginTop: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  역할 추가
                </button>
              </>
            ) : (
              <>
                <div className="role-rows">
                  {publicLaborRows.map((row) => {
                    const dailyWage = regulation ? (row.laborRole === "simple" ? regulation.simpleLaborDailyWage : regulation.foremanDailyWage) : null;
                    const hourlyRate = regulation ? publicHourlyRate(regulation, row.laborRole) : null;
                    return (
                      <div key={row.id} className="role-row">
                        <div className="field">
                          <label>법정직종</label>
                          <div className="role-pill">
                            <button
                              type="button"
                              style={row.laborRole === "simple" ? ACTIVE_PILL_STYLE : undefined}
                              onClick={() => updatePublicRow(row.id, { laborRole: "simple" })}
                            >
                              127. 단순노무종사원
                            </button>
                            <button
                              type="button"
                              style={row.laborRole === "foreman" ? ACTIVE_PILL_STYLE : undefined}
                              onClick={() => updatePublicRow(row.id, { laborRole: "foreman" })}
                            >
                              129. 작업반장
                            </button>
                          </div>
                        </div>
                        <div className="field qty">
                          <label>인원수</label>
                          <input
                            type="number"
                            value={row.workerCount}
                            onChange={(e) => updatePublicRow(row.id, { workerCount: Number(e.target.value) || 0 })}
                          />
                        </div>
                        <button
                          type="button"
                          className="row-remove"
                          onClick={() => removePublicRow(row.id)}
                          disabled={publicLaborRows.length === 1}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                        {dailyWage !== null && hourlyRate !== null && (
                          <div className="note">
                            적용 법정노임: {Math.round(dailyWage).toLocaleString()}원/일 ({Math.round(hourlyRate).toLocaleString()}원/h)
                            {regulation && ` · ${regulation.label} 기준`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="add-row-btn" onClick={addPublicRow} style={{ marginTop: 12 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  역할 추가
                </button>

                <div className="field" style={{ marginTop: 18, maxWidth: 280 }}>
                  <label>법정비용 (원, 4대보험 등)</label>
                  <input type="number" value={legalCost} onChange={(e) => setLegalCost(Number(e.target.value) || 0)} />
                </div>
                {suggestedLegalCost !== null && (
                  <button
                    type="button"
                    className="add-row-btn"
                    style={{ marginTop: 8, color: "var(--text-muted)" }}
                    onClick={() => setLegalCost(Math.round(suggestedLegalCost))}
                  >
                    추천값 적용: {Math.round(suggestedLegalCost).toLocaleString()}원 (노무비 × 4대보험 회사부담률, 참고용)
                  </button>
                )}
              </>
            )}
          </div>

          {/* 4. 경비 항목 */}
          <div className="card">
            <div className="card-head">
              <h2>현장경비</h2>
              <span className="step">4</span>
            </div>
            {expenseItems.length > 0 ? (
              <div className="expense-groups">
                {CATEGORY_ORDER.map((cat) => {
                  const items = expenseItems.filter((it) => it.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="expense-group">
                      <div className="expense-group-label">{CATEGORY_LABELS[cat] ?? cat}</div>
                      <div className="expense-grid">
                        {items.map((item) => (
                          <label key={item.id} className="expense-item">
                            <input type="checkbox" checked={selectedExpenseIds.has(item.id)} onChange={() => toggleExpense(item.id)} />
                            {item.name}
                            <span className="cost num">{item.unit_cost.toLocaleString()}원</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>등록된 경비 항목이 없습니다.</p>
            )}
          </div>

          {/* 5. 비율 */}
          <div className="card">
            <div className="card-head">
              <h2>비율</h2>
              <span className="step">5</span>
            </div>
            <div className="rate-grid">
              <div className="field">
                <label>일반관리비율 (%)</label>
                <input type="number" value={generalAdminRate} onChange={(e) => setGeneralAdminRate(Number(e.target.value) || 0)} />
                {mode === "public" && regulation && generalAdminRate > regulation.generalAdminRateCap && (
                  <div className="rate-clamp">
                    입력 {generalAdminRate}% → 법정 상한 {regulation.generalAdminRateCap}%로 자동 조정
                  </div>
                )}
              </div>
              <div className="field">
                <label>이윤율 (%)</label>
                <input type="number" value={profitRate} onChange={(e) => setProfitRate(Number(e.target.value) || 0)} />
                {mode === "public" && regulation && profitRate > regulation.profitRateCap && (
                  <div className="rate-clamp">
                    입력 {profitRate}% → 법정 상한 {regulation.profitRateCap}%로 자동 조정
                  </div>
                )}
              </div>
              <div className="field">
                <label>VAT율 (%)</label>
                <input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value) || 0)} />
              </div>
            </div>
            {mode === "public" && regulation && (
              <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
                공공모드 상한: 관리비 {regulation.generalAdminRateCap}% / 이윤 {regulation.profitRateCap}% — 저장 시 자동으로 상한을 넘지 않게
                조정됩니다.
              </p>
            )}
          </div>

          {/* 6. 현장조건 (접힘) */}
          <div className="card">
            <div className="collapse-head" onClick={() => setConditionsOpen((v) => !v)}>
              <h2>현장 특이사항</h2>
              <span className="tag-info">참고용 · 계산에 미반영</span>
              <span className={`collapse-chevron ${conditionsOpen ? "open" : ""}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
            <div className="collapse-body" hidden={!conditionsOpen}>
              <div className="field-grid">
                <div className="field">
                  <label>오염도</label>
                  <select value={contaminationLevel} onChange={(e) => setContaminationLevel(e.target.value)}>
                    {["낮음", "보통", "높음"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>화장실 수</label>
                  <input
                    type="number"
                    value={restroomCount}
                    onChange={(e) => setRestroomCount(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>계단 층수</label>
                  <input
                    type="number"
                    value={stairFloors}
                    onChange={(e) => setStairFloors(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label>바닥재질</label>
                  <input type="text" value={floorMaterial} onChange={(e) => setFloorMaterial(e.target.value)} placeholder="예: 타일, 대리석, 장판" />
                </div>
                <div className="field">
                  <label>주차</label>
                  <input type="text" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="예: 가능, 불가능, 유료" />
                </div>
                <div className="field">
                  <label>집기밀도</label>
                  <select value={furnitureDensity} onChange={(e) => setFurnitureDensity(e.target.value)}>
                    {["낮음", "보통", "높음"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 16 }}>
                <label>특이사항</label>
                <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="sidebar-wrap">
          <div className="sidebar-card">
            <div className="sidebar-head">
              <h2>계산결과</h2>
            </div>
            {preview ? (
              <>
                <div className="sidebar-body">
                  <div className="sr">
                    <span className="l">예상 작업시간</span>
                    <span className="v num">{preview.estimatedHours.toFixed(1)}h</span>
                  </div>
                  <div className="sr">
                    <span className="l">필요 인원</span>
                    <span className="v num">{preview.estimatedWorkers}명</span>
                  </div>
                  {preview.lineItems
                    .filter((item) => item.category === "labor")
                    .map((item, index) => (
                      <div className="sr indent" key={`labor-${index}`}>
                        <span className="l">{item.label}</span>
                        <span className="v num">{won(item.amount)}</span>
                      </div>
                    ))}
                  {preview.legalCost > 0 && (
                    <div className="sr">
                      <span className="l">법정비용</span>
                      <span className="v num">{won(preview.legalCost)}</span>
                    </div>
                  )}
                  <div className="sr">
                    <span className="l">경비</span>
                    <span className="v num">{won(preview.expenseCost)}</span>
                  </div>
                  <div className="sr">
                    <span className="l">관리비 ({preview.appliedGeneralAdminRate.toFixed(2).replace(/\.00$/, "")}%)</span>
                    <span className="v num">{won(preview.adminCost)}</span>
                  </div>
                  <div className="sr">
                    <span className="l">이윤 ({preview.appliedProfitRate.toFixed(2).replace(/\.00$/, "")}%)</span>
                    <span className="v num">{won(preview.profitAmount)}</span>
                  </div>
                  <div className="sr">
                    <span className="l">VAT</span>
                    <span className="v num">{won(preview.vatAmount)}</span>
                  </div>
                </div>
                <div className="sidebar-final">
                  <span className="l">최종 견적</span>
                  <span className="v num">{won(preview.quoteAmount)}</span>
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="sidebar-actions">
                  <button type="button" className="btn btn-secondary" onClick={handleSubmit} disabled={isPending}>
                    임시저장
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={isPending}>
                    {isPending ? "저장 중..." : "견적서 생성"}
                  </button>
                </div>
              </>
            ) : (
              <div className="sidebar-empty">현장정보와 역할별 인원·시급을 입력하면 실시간으로 계산됩니다.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
