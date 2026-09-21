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

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">생산성 기준 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          청소 업무별 생산성 기준을 설정할 수 있습니다. 업계 기본값을 참고하거나, 회사의 실제 환경에 맞게
          커스텀할 수 있습니다.
        </p>
      </div>

      {/* 회사 커스텀 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">회사 커스텀 ({customRates.length}개)</h2>
            <p className="mt-1 text-sm text-gray-500">목록에 없는 청소 항목(예: 카펫청소)을 새로 추가할 때 여기를 써요.</p>
          </div>
          <details className="relative">
            <summary className="list-none rounded-md bg-black px-4 py-2 text-sm font-medium text-white cursor-pointer select-none">
              + 새 기준 추가
            </summary>
            <form action={createCustomWorkType} className="mt-3 flex items-end gap-2 rounded-md border border-gray-200 p-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="new_name" className="text-sm font-medium">
                  이름
                </label>
                <input
                  id="new_name"
                  name="new_name"
                  required
                  placeholder="예: 카펫청소"
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="new_sqm_per_hour" className="text-sm font-medium">
                  생산성 기준 (㎡/시간)
                </label>
                <input
                  id="new_sqm_per_hour"
                  name="new_sqm_per_hour"
                  type="number"
                  step="0.01"
                  required
                  className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
                추가
              </button>
            </form>
          </details>
        </div>

        {customRates.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">업무유형</th>
                <th className="py-2">생산성 기준 (㎡/시간)</th>
                <th className="py-2">최근 수정일</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {customRates.map((rate) => (
                <tr key={rate.workType} className="border-b">
                  <td className="py-2">{rate.name}</td>
                  <td className="py-2">
                    <form action={upsertProductivityOverride} className="flex items-center gap-2">
                      <input type="hidden" name="work_type" value={rate.workType} />
                      <input
                        type="number"
                        name="sqm_per_hour"
                        defaultValue={rate.sqmPerHour}
                        step="0.01"
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button type="submit" className="text-xs underline">
                        저장
                      </button>
                    </form>
                  </td>
                  <td className="py-2 text-gray-500">{formatDateTime(rate.updatedAt)}</td>
                  <td className="py-2 text-right">
                    <details className="inline-block">
                      <summary className="inline text-xs text-blue-600 underline cursor-pointer select-none">수정</summary>
                      <form action={renameCustomWorkType} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="work_type" value={rate.workType} />
                        <input
                          type="text"
                          name="new_name"
                          defaultValue={rate.name}
                          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button type="submit" className="text-xs underline">
                          저장
                        </button>
                      </form>
                    </details>
                    <span className="mx-2 text-gray-300">|</span>
                    <DeleteCustomWorkTypeButton workType={rate.workType} name={rate.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">아직 추가한 커스텀 작업유형이 없습니다.</p>
        )}
      </section>

      {/* 업계 기본값 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">업계 기본값 ({defaultRates.length}개)</h2>
            <p className="mt-1 text-sm text-gray-500">여기 있는 {defaultRates.length}개 항목은 숫자만 우리 회사에 맞게 바꿀 수 있어요.</p>
          </div>
          <ResetAllButton />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">업무유형</th>
              <th className="py-2">업계 기본값 (㎡/시간)</th>
              <th className="py-2">현재 적용값 (㎡/시간)</th>
              <th className="py-2">출처</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {defaultRates.map((rate) => (
              <tr key={rate.workType} className="border-b">
                <td className="py-2">{rate.label}</td>
                <td className="py-2 text-gray-500">{rate.globalValue}</td>
                <td className="py-2">
                  {rate.isOverridden ? (
                    <form action={upsertProductivityOverride} className="flex items-center gap-2">
                      <input type="hidden" name="work_type" value={rate.workType} />
                      <input
                        type="number"
                        name="sqm_per_hour"
                        defaultValue={rate.currentValue}
                        step="0.01"
                        className="w-24 rounded-md border border-gray-300 bg-blue-50 px-2 py-1 text-sm"
                      />
                      <button type="submit" className="text-xs underline">
                        저장
                      </button>
                    </form>
                  ) : (
                    rate.currentValue
                  )}
                </td>
                <td className="py-2">
                  <span
                    className={
                      "rounded px-2 py-0.5 text-xs " +
                      (rate.isOverridden ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500")
                    }
                  >
                    {rate.isOverridden ? "회사 설정값" : "업계 기본값"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {rate.isOverridden ? (
                    <form action={resetProductivityRate}>
                      <input type="hidden" name="work_type" value={rate.workType} />
                      <button type="submit" className="text-xs text-gray-500 underline">
                        기본값으로 되돌리기
                      </button>
                    </form>
                  ) : (
                    <form action={upsertProductivityOverride}>
                      <input type="hidden" name="work_type" value={rate.workType} />
                      <input type="hidden" name="sqm_per_hour" value={rate.globalValue} />
                      <button type="submit" className="text-xs text-blue-600 underline">
                        회사기준 설정
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900">
        여기서 바꾼 기준은 다음에 만드는 새 견적부터 적용돼요. 이미 작성된 견적서는 바뀌지 않아요.
      </div>
    </main>
  );
}
