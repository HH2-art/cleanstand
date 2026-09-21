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
const PUBLIC_ROLE_LABELS: Record<PublicLaborLine["laborRole"], string> = {
  simple: "127. 단순노무종사원",
  foreman: "129. 작업반장",
};

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

export function NewQuoteForm({
  company,
  roleRates,
  productivityRates,
  expenseItems,
  regulation,
}: {
  company: { generalAdminRate: number; profitRate: number; vatRate: number };
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
  const [areaSqm, setAreaSqm] = useState<number | "">("");
  const [frequencyPerWeek, setFrequencyPerWeek] = useState<number | "">(5);
  const [monthlyHoursPerWorker, setMonthlyHoursPerWorker] = useState(209); // 참고용 힌트 계산에만 쓰임

  // site_conditions — 계산엔 안 쓰이는 참고용 현장 맥락 정보
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

  const selectedProductivity = productivityRates.find((r) => r.work_type === workType);
  const selectedExpenses = expenseItems
    .filter((item) => selectedExpenseIds.has(item.id))
    .map((item) => ({ name: item.name, amount: item.unit_cost }));

  const numericAreaSqm = typeof areaSqm === "number" ? areaSqm : 0;
  const numericFrequency = typeof frequencyPerWeek === "number" ? frequencyPerWeek : 0;

  const hoursHint = useMemo(() => {
    if (!selectedProductivity || numericAreaSqm <= 0 || numericFrequency <= 0) return null;
    return estimateHours({ areaSqm: numericAreaSqm, sqmPerHour: selectedProductivity.sqmPerHour, frequencyPerWeek: numericFrequency });
  }, [selectedProductivity, numericAreaSqm, numericFrequency]);

  const workersHint = hoursHint !== null ? estimateWorkers(hoursHint, monthlyHoursPerWorker) : null;

  // 실시간 계산 미리보기 — 계산엔진은 순수함수라 클라이언트에서 바로 돌려도 안전하다.
  // (저장 시점에는 서버가 생산성/경비/법정기준값을 DB에서 다시 조회해 재계산한다.)
  const preview = useMemo(() => {
    if (!selectedProductivity || numericAreaSqm <= 0 || numericFrequency <= 0) return null;

    const site = { areaSqm: numericAreaSqm, sqmPerHour: selectedProductivity.sqmPerHour, frequencyPerWeek: numericFrequency };

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
    selectedProductivity,
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
  // 정밀 계산 베이스(보수 상하한 등)는 노무사 확인이 필요하다는 사업계획 문서의 캐벗을
  // 그대로 반영 — 어디까지나 시작점이고 항상 직접 수정 가능하다.
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

  return (
    <div className="flex flex-col gap-8">
      {/* 모드 선택 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">모드</h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={mode === "private"} onChange={() => setMode("private")} />
            일반 견적 (민간)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={mode === "public"}
              onChange={() => setMode("public")}
              disabled={!regulation}
            />
            공공입찰 원가계산{!regulation && " (법정기준값 없음)"}
          </label>
        </div>
      </section>

      {/* 현장정보 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">현장정보</h2>
        <div className="grid grid-cols-2 gap-4">
          <TextField label="현장명 *" value={buildingName} onChange={setBuildingName} />
          <SelectField label="건물유형" value={buildingType} onChange={setBuildingType} options={BUILDING_TYPES} />
          <SelectField
            label="청소범위 (작업유형) *"
            value={workType}
            onChange={setWorkType}
            options={productivityRates.map((r) => r.work_type)}
            labels={Object.fromEntries(
              productivityRates.map((r) => [r.work_type, workTypeLabel(r.work_type, r.displayName)]),
            )}
          />
          <NumberField label="면적 (㎡) *" value={areaSqm} onChange={setAreaSqm} />
          <NumberField label="빈도 (주 n회) *" value={frequencyPerWeek} onChange={setFrequencyPerWeek} />
          <NumberField
            label="1인당 월 투입 가능시간 (참고용)"
            value={monthlyHoursPerWorker}
            onChange={(v) => setMonthlyHoursPerWorker(Number(v) || 209)}
          />
        </div>
        {selectedProductivity && (
          <p className="text-xs text-gray-400">
            생산성 기준: {selectedProductivity.sqmPerHour}㎡/h{selectedProductivity.isOverridden && " (회사 커스텀값)"}
            {hoursHint !== null && ` · 예상 작업시간: ${hoursHint.toFixed(1)}h`}
            {workersHint !== null && ` · 참고 추정 총인원: 약 ${workersHint}명 (아래에서 역할별로 직접 배분하세요)`}
          </p>
        )}
      </section>

      {/* 지난 견적 참고 */}
      {pastQuotes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            지난 견적 참고 <span className="text-xs font-normal text-gray-400">({buildingType} 유형 최근 {pastQuotes.length}건)</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pastQuotes.map((q) => (
              <div key={q.id} className="flex flex-col gap-1 rounded-md border border-gray-200 p-3 text-sm">
                <p className="font-medium">{q.buildingName}</p>
                <p className="text-xs text-gray-400">
                  {q.areaSqm.toLocaleString()}㎡ · 주 {q.frequencyPerWeek}회 · {q.mode === "private" ? "일반" : "공공입찰"}
                </p>
                <p className="text-xs text-gray-400">{won(q.quoteAmount)}</p>
                <button
                  type="button"
                  onClick={() => handleReuse(q.id)}
                  disabled={reusingId === q.id}
                  className="mt-1 w-fit text-xs underline disabled:opacity-40"
                >
                  {reusingId === q.id ? "불러오는 중..." : "이 구성으로 시작하기"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* site_conditions — 참고용 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">
          현장 특이사항 <span className="text-xs font-normal text-gray-400">(계산에는 쓰이지 않는 참고용 정보)</span>
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="오염도" value={contaminationLevel} onChange={setContaminationLevel} options={["낮음", "보통", "높음"]} />
          <NumberField label="화장실 수" value={restroomCount} onChange={setRestroomCount} />
          <NumberField label="계단 층수" value={stairFloors} onChange={setStairFloors} />
          <TextField label="바닥재질" value={floorMaterial} onChange={setFloorMaterial} placeholder="예: 타일, 대리석, 장판" />
          <TextField label="주차" value={parking} onChange={setParking} placeholder="예: 가능, 불가능, 유료" />
          <SelectField label="집기밀도" value={furnitureDensity} onChange={setFurnitureDensity} options={["낮음", "보통", "높음"]} />
        </div>
        <TextAreaField label="특이사항" value={notes} onChange={setNotes} />
      </section>

      {/* 노동원가 — 역할별 인원 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">노동원가 — 역할별 인원</h2>
        {mode === "private" ? (
          <>
            {roleRates.length === 0 && (
              <p className="text-xs text-gray-400">아직 등록된 직원이 없습니다 — 역할명과 시급원가를 직접 입력해주세요.</p>
            )}
            <div className="flex flex-col gap-2">
              {privateLaborRows.map((row) => (
                <div key={row.id} className="flex items-end gap-2">
                  {roleRates.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">역할</label>
                      <select
                        value={roleRates.some((r) => r.role_name === row.roleName) ? row.roleName : "__custom__"}
                        onChange={(e) => {
                          const rate = roleRates.find((r) => r.role_name === e.target.value);
                          if (rate) updatePrivateRow(row.id, { roleName: rate.role_name, hourlyRate: rate.standard_hourly_rate });
                          else updatePrivateRow(row.id, { roleName: "" });
                        }}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        {roleRates.map((r) => (
                          <option key={r.role_name} value={r.role_name}>
                            {r.role_name}
                          </option>
                        ))}
                        <option value="__custom__">직접 입력</option>
                      </select>
                    </div>
                  ) : null}
                  {(roleRates.length === 0 || !roleRates.some((r) => r.role_name === row.roleName)) && (
                    <TextField
                      label="역할명"
                      value={row.roleName}
                      onChange={(v) => updatePrivateRow(row.id, { roleName: v })}
                      placeholder="예: 일반청소원, 반장"
                    />
                  )}
                  <NumberField
                    label="인원수"
                    value={row.workerCount}
                    onChange={(v) => updatePrivateRow(row.id, { workerCount: Number(v) || 0 })}
                  />
                  <NumberField
                    label="표준 시급원가 (원/h)"
                    value={row.hourlyRate}
                    onChange={(v) => updatePrivateRow(row.id, { hourlyRate: Number(v) || 0 })}
                  />
                  <button
                    type="button"
                    onClick={() => removePrivateRow(row.id)}
                    disabled={privateLaborRows.length === 1}
                    className="mb-1 text-xs text-red-600 underline disabled:opacity-30"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addPrivateRow} className="w-fit text-xs underline">
              + 역할 추가
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {publicLaborRows.map((row) => {
                const dailyWage = regulation
                  ? row.laborRole === "simple"
                    ? regulation.simpleLaborDailyWage
                    : regulation.foremanDailyWage
                  : null;
                const hourlyRate = regulation ? publicHourlyRate(regulation, row.laborRole) : null;
                return (
                  <div key={row.id} className="flex flex-col gap-1">
                    <div className="flex items-end gap-2">
                      <SelectField
                        label="노무비 직종"
                        value={row.laborRole}
                        onChange={(v) => updatePublicRow(row.id, { laborRole: v as PublicLaborLine["laborRole"] })}
                        options={["simple", "foreman"]}
                        labels={PUBLIC_ROLE_LABELS}
                      />
                      <NumberField
                        label="인원수"
                        value={row.workerCount}
                        onChange={(v) => updatePublicRow(row.id, { workerCount: Number(v) || 0 })}
                      />
                      <button
                        type="button"
                        onClick={() => removePublicRow(row.id)}
                        disabled={publicLaborRows.length === 1}
                        className="mb-1 text-xs text-red-600 underline disabled:opacity-30"
                      >
                        삭제
                      </button>
                    </div>
                    {dailyWage !== null && hourlyRate !== null && (
                      <p className="text-xs text-gray-400">
                        적용 법정노임: {Math.round(dailyWage).toLocaleString()}원/일 ({Math.round(hourlyRate).toLocaleString()}원/h)
                        {regulation && ` · ${regulation.label} 기준`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addPublicRow} className="w-fit text-xs underline">
              + 역할 추가
            </button>

            <div className="mt-2 flex flex-col gap-1">
              <NumberField label="법정비용 (원, 4대보험 등)" value={legalCost} onChange={(v) => setLegalCost(Number(v) || 0)} />
              {suggestedLegalCost !== null && (
                <button
                  type="button"
                  onClick={() => setLegalCost(Math.round(suggestedLegalCost))}
                  className="w-fit text-xs text-gray-400 underline"
                >
                  추천값 적용: {Math.round(suggestedLegalCost).toLocaleString()}원 (노무비 × 4대보험 회사부담률, 참고용)
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* 현장경비 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">현장경비</h2>
        {expenseItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {expenseItems.map((item) => (
              <label key={item.id} className="flex items-center gap-2">
                <input type="checkbox" checked={selectedExpenseIds.has(item.id)} onChange={() => toggleExpense(item.id)} />
                {item.name} ({CATEGORY_LABELS[item.category] ?? item.category}, {item.unit_cost.toLocaleString()}원)
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">등록된 경비 항목이 없습니다.</p>
        )}
      </section>

      {/* 비율 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">비율</h2>
        <div className="grid grid-cols-3 gap-4">
          <NumberField label="일반관리비율 (%)" value={generalAdminRate} onChange={(v) => setGeneralAdminRate(Number(v) || 0)} />
          <NumberField label="이윤율 (%)" value={profitRate} onChange={(v) => setProfitRate(Number(v) || 0)} />
          <NumberField label="VAT율 (%)" value={vatRate} onChange={(v) => setVatRate(Number(v) || 0)} />
        </div>
        {mode === "public" && regulation && (
          <p className="text-xs text-gray-400">
            공공모드 상한: 관리비 {regulation.generalAdminRateCap}% / 이윤 {regulation.profitRateCap}% — 저장 시 자동으로 상한을 넘지 않게 조정됩니다.
          </p>
        )}
      </section>

      {/* 계산결과 실시간 미리보기 */}
      <section className="flex flex-col gap-2 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">계산결과</h2>
        {preview ? (
          <div className="flex flex-col gap-1 text-sm">
            <Row label="예상 작업시간" value={`${preview.estimatedHours.toFixed(1)}h`} />
            <Row label="투입 인원 합계" value={`${preview.estimatedWorkers}명`} />
            {preview.lineItems
              .filter((item) => item.category === "labor")
              .map((item, index) => (
                <Row key={`labor-${index}`} label={item.label} value={won(item.amount)} />
              ))}
            <Row label="직접노무비 합계" value={won(preview.laborCost)} />
            {preview.legalCost > 0 && <Row label="법정비용" value={won(preview.legalCost)} />}
            <Row label="현장경비" value={won(preview.expenseCost)} />
            <Row label="일반관리비" value={`${won(preview.adminCost)} (${preview.appliedGeneralAdminRate.toFixed(2)}%)`} />
            <Row label="기업이윤" value={`${won(preview.profitAmount)} (${preview.appliedProfitRate.toFixed(2)}%)`} />
            <Row label="공급가액" value={won(preview.supplyAmount)} bold />
            <Row label="VAT" value={won(preview.vatAmount)} />
            <Row label="최종 견적" value={won(preview.quoteAmount)} bold large />
          </div>
        ) : (
          <p className="text-sm text-gray-400">현장정보와 역할별 인원·시급을 입력하면 실시간으로 계산됩니다.</p>
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!preview || isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "저장 중..." : "견적 저장"}
      </button>
    </div>
  );
}

function won(amount: number) {
  return `${Math.round(amount).toLocaleString()}원`;
}

function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${large ? "text-base" : ""}`}>
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels?.[opt] ?? opt}
          </option>
        ))}
      </select>
    </div>
  );
}
