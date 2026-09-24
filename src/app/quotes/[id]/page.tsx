import Link from "next/link";
import { notFound } from "next/navigation";
import "@/styles/app-shell.css";
import "./quote-detail.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { QuoteStatusControl } from "./QuoteStatusControl";

// site_conditions JSONB — 실제 저장 키(NewQuoteForm.tsx handleSubmit과 동일 순서/키)와
// 한글 라벨. 디자인 캔버스(Main.dc.html)의 SITE_CONDITION_LABELS를 그대로 옮겼다.
const SITE_CONDITION_LABELS: Record<string, string> = {
  contamination_level: "오염도",
  restroom_count: "화장실 수",
  stair_floors: "계단 층수",
  floor_material: "바닥재질",
  parking: "주차",
  furniture_density: "집기밀도",
  notes: "특이사항",
};
const SITE_CONDITION_KEYS = Object.keys(SITE_CONDITION_LABELS);

const MODE_LABELS: Record<string, string> = { private: "일반 견적", public: "공공입찰 원가계산" };

function won(amount: number) {
  return `${Math.round(amount).toLocaleString()}원`;
}
function fmtRate(rate: number) {
  return rate.toFixed(2).replace(/\.00$/, "");
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

  const items = lineItems ?? [];
  const laborItems = items.filter((item) => item.category === "labor");
  const legalItem = items.find((item) => item.label === "법정비용");
  const expenseItem = items.find((item) => item.category === "expense");
  const adminItem = items.find((item) => item.category === "admin");
  const profitItem = items.find((item) => item.category === "profit");
  const vatItem = items.find((item) => item.category === "vat");

  // admin/profit 비율(%)은 quotes 테이블에 컬럼으로 저장되지 않는다(계산된 금액만
  // 저장) — buildCostBreakdown 공식의 역함수로 실제 적용된 비율을 그대로 복원한다
  // (src/app/actions/quotes.ts의 getQuoteForEdit과 같은 계산, 표시용이라 이 페이지
  // 안에서 바로 계산).
  const adminBase = Number(quote.labor_cost) + Number(quote.legal_cost) + Number(quote.expense_cost);
  const profitBase = adminBase + Number(quote.admin_cost);
  const appliedAdminRate = adminBase > 0 ? (Number(quote.admin_cost) / adminBase) * 100 : 0;
  const appliedProfitRate = profitBase > 0 ? (Number(quote.profit_amount) / profitBase) * 100 : 0;

  const siteConditions = (quote.site_conditions ?? {}) as Record<string, unknown>;
  const siteConditionRows = SITE_CONDITION_KEYS.map((key) => ({
    key,
    label: SITE_CONDITION_LABELS[key],
    value: siteConditions[key],
    full: key === "notes",
  })).filter((row) => row.value !== null && row.value !== undefined && row.value !== "");

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="dashboard" companyName={company.name} logoUrl={company.logo_url} />
      <div className="main">
        <div className="quote-detail-page">
          <Link className="back-link" href="/dashboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            견적 목록
          </Link>

          <div className="header">
            <h1>{quote.building_name}</h1>
            <div className="header-summary">
              <span className="mode-badge">{MODE_LABELS[quote.mode] ?? quote.mode}</span>
              <span className="dot">·</span>
              <span>{quote.building_type ?? "건물유형 미지정"}</span>
              <span className="dot">·</span>
              <span className="num">{Number(quote.area_sqm).toLocaleString("ko-KR")}㎡</span>
              <span className="dot">·</span>
              <span>주 {quote.frequency_per_week}회</span>
            </div>

            <div className="action-row">
              <a href={`/quotes/${quote.id}/pdf/estimate`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M12 11v6M9 14l3 3 3-3" />
                </svg>
                견적서 PDF
              </a>
              <a href={`/quotes/${quote.id}/pdf/breakdown`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M9 13h6M9 17h6" />
                </svg>
                산출내역서 PDF
              </a>
            </div>

            <QuoteStatusControl
              quoteId={quote.id}
              status={quote.status}
              rightSlot={
                quote.status === "draft" && (
                  <Link href={`/quotes/${quote.id}/edit`} className="btn btn-secondary edit-link">
                    수정
                  </Link>
                )
              }
            />
          </div>

          <div className="card">
            <h2>산출내역</h2>
            <div style={{ marginTop: 10 }}>
              <div className="sr">
                <span className="l">예상 작업시간</span>
                <span className="v num">{Number(quote.estimated_hours).toFixed(1)}h</span>
              </div>
              <div className="sr">
                <span className="l">필요 인원</span>
                <span className="v num">{quote.estimated_workers}명</span>
              </div>
              {laborItems.map((item) => (
                <div className="sr indent" key={item.id}>
                  <span className="l">{item.label}</span>
                  <span className="v num">{won(item.amount)}</span>
                </div>
              ))}
              {legalItem && (
                <div className="sr">
                  <span className="l">법정비용</span>
                  <span className="v num">{won(legalItem.amount)}</span>
                </div>
              )}
              {expenseItem && (
                <div className="sr">
                  <span className="l">현장경비</span>
                  <span className="v num">{won(expenseItem.amount)}</span>
                </div>
              )}
              {adminItem && (
                <div className="sr">
                  <span className="l">일반관리비 ({fmtRate(appliedAdminRate)}%)</span>
                  <span className="v num">{won(adminItem.amount)}</span>
                </div>
              )}
              {profitItem && (
                <div className="sr">
                  <span className="l">기업이윤 ({fmtRate(appliedProfitRate)}%)</span>
                  <span className="v num">{won(profitItem.amount)}</span>
                </div>
              )}
              {vatItem && (
                <div className="sr">
                  <span className="l">VAT</span>
                  <span className="v num">{won(vatItem.amount)}</span>
                </div>
              )}
            </div>
            <div className="final-row">
              <span className="l">최종 견적</span>
              <span className="v num">{won(quote.quote_amount)}</span>
            </div>
          </div>

          {siteConditionRows.length > 0 && (
            <div className="card">
              <h2>현장 특이사항</h2>
              <div className="cond-grid">
                {siteConditionRows.map((row) => (
                  <div className={`cond-row ${row.full ? "full" : ""}`} key={row.key}>
                    <span className="l">{row.label}</span>
                    <span className="v">{String(row.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
