import Link from "next/link";
import { notFound } from "next/navigation";
import { updateQuoteStatus } from "@/app/actions/quotes";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  sent: "발송완료",
  won: "수주성공",
  lost: "수주실패",
};

function won(amount: number) {
  return `${Math.round(amount).toLocaleString()}원`;
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!quote) notFound();

  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order");

  const siteConditions = (quote.site_conditions ?? {}) as Record<string, unknown>;
  const siteConditionEntries = Object.entries(siteConditions).filter(([, v]) => v !== null && v !== "");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-12">
      <div>
        <Link href="/dashboard" className="text-xs text-gray-400 underline">
          ← 견적 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{quote.building_name}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {quote.mode === "private" ? "일반 견적" : "공공입찰 원가계산"} · {quote.building_type ?? "건물유형 미지정"} ·{" "}
          {quote.area_sqm}㎡ · 주 {quote.frequency_per_week}회
        </p>
      </div>

      <section className="flex flex-wrap gap-3 text-sm">
        <a
          href={`/quotes/${quote.id}/pdf/estimate`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-3 py-1.5 underline"
        >
          견적서 PDF
        </a>
        <a
          href={`/quotes/${quote.id}/pdf/breakdown`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-300 px-3 py-1.5 underline"
        >
          산출내역서 PDF
        </a>
      </section>

      <section className="flex items-center gap-3">
        <span className="text-sm font-medium">상태:</span>
        <form action={updateQuoteStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={quote.id} />
          <select
            name="status"
            defaultValue={quote.status}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="text-xs underline">
            변경
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-gray-200 p-4">
        <h2 className="text-lg font-semibold">산출내역</h2>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>예상 작업시간</span>
            <span>{Number(quote.estimated_hours).toFixed(1)}h</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>필요 인원</span>
            <span>{quote.estimated_workers}명</span>
          </div>
          {(lineItems ?? []).map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-gray-500">{item.label}</span>
              <span>{won(item.amount)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <span>최종 견적</span>
            <span>{won(quote.quote_amount)}</span>
          </div>
        </div>
      </section>

      {siteConditionEntries.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">현장 특이사항</h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            {siteConditionEntries.map(([key, value]) => (
              <div key={key}>
                <span className="text-gray-400">{key}:</span> {String(value)}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
