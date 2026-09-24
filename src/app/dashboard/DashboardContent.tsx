"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface DashboardQuoteRow {
  id: string;
  name: string;
  buildingType: string;
  area: number | null;
  mode: "private" | "public";
  status: "draft" | "sent" | "won" | "lost";
  amount: number;
  date: string; // "YYYY.MM.DD", formatted server-side
  monthKey: string; // "YYYY-MM", for this-month/last-month grouping
}

export interface DashboardActivityRow {
  description: string;
  time: string;
}

/**
 * 대시보드 본문 — CleanStand Dashboard 디자인 캔버스(Main.dc.html)의
 * Component/renderVals() 로직과 마크업을 그대로 이식. 캔버스는 하드코딩된
 * QUOTES 예시 배열을 썼지만, 여기서는 부모(page.tsx)가 실제 quotes/activity_log
 * 쿼리 결과를 props로 내려준다 — 필터링/페이지네이션/집계 로직 자체는 동일하다.
 */
const STATUS_DEF: { value: string; label: string; cls?: string }[] = [
  { value: "", label: "전체" },
  { value: "draft", label: "임시저장", cls: "badge-neutral" },
  { value: "sent", label: "발송완료", cls: "badge-brand" },
  { value: "won", label: "수주성공", cls: "badge-success" },
  { value: "lost", label: "수주실패", cls: "badge-lost" },
];

const BUILDING_TYPES = ["오피스", "병원", "공장", "학교", "상가", "기타"];

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--border-strong)",
  sent: "var(--brand)",
  won: "var(--success)",
  lost: "var(--status-lost)",
};

const DONUT_SIZE = 108;
const DONUT_STROKE = 16;
const DONUT_RADIUS = DONUT_SIZE / 2 - DONUT_STROKE / 2;
const DONUT_CIRC = 2 * Math.PI * DONUT_RADIUS;

const PAGE_SIZE = 5;

/** KPI 카드 우측 상단 증감 배지 — 지난달 대비 증감률(%). 지난달 값이 0이면 신규 발생만
 * "up"으로, 그 외엔 변화 없음으로 표시한다(0으로 나누기 방지). */
function fmtDeltaPill(curr: number, prev: number) {
  if (prev === 0) {
    return curr > 0 ? { dir: "up" as const, pct: 100 } : { dir: "flat" as const, pct: 0 };
  }
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct === 0) return { dir: "flat" as const, pct: 0 };
  return { dir: pct > 0 ? ("up" as const) : ("down" as const), pct: Math.abs(pct) };
}
function won(n: number) {
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

export function DashboardContent({
  quotes,
  activity,
  currentMonthKey,
  prevMonthKey,
}: {
  quotes: DashboardQuoteRow[];
  activity: DashboardActivityRow[];
  currentMonthKey: string;
  prevMonthKey: string;
}) {
  const router = useRouter();
  // 상태/건물유형/검색어 전부 즉시 반영 — 실제 쿼리의 .eq()/.ilike() 조건과 동일하게,
  // 값이 바뀌는 즉시 다시 필터링한다(커밋 버튼 없음).
  const [status, setStatus] = useState("");
  const [buildingType, setBuildingType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // 도넛 그리기 애니메이션 — 마운트 직후 한 프레임 뒤에 true로 바뀌면서
  // stroke-dasharray가 0에서 실제 값까지 CSS transition으로 자란다.
  const [donutAnimated, setDonutAnimated] = useState(false);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDonutAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function pillStyle(isActive: boolean) {
    return isActive
      ? { background: "var(--brand-subtle)", borderColor: "var(--brand-border)", color: "var(--brand)", fontWeight: 600 }
      : undefined;
  }

  const statusPills = STATUS_DEF.map((d) => ({
    label: d.label,
    style: pillStyle(status === d.value),
    pick: () => { setStatus(d.value); setPage(0); },
  }));
  const typePills = [{ value: "", label: "전체" }, ...BUILDING_TYPES.map((t) => ({ value: t, label: t }))].map((d) => ({
    label: d.label,
    style: pillStyle(buildingType === d.value),
    pick: () => { setBuildingType(d.value); setPage(0); },
  }));

  const searchTerm = search.trim().toLowerCase();
  // building_name.ilike(`%${search}%`)와 동일한 대소문자 무시 부분일치.
  const filtered = quotes.filter((q) => {
    if (status && q.status !== status) return false;
    if (buildingType && q.buildingType !== buildingType) return false;
    if (searchTerm && !q.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  const statusLabelMap = Object.fromEntries(STATUS_DEF.filter((d) => d.value).map((d) => [d.value, d]));

  const rows = filtered.map((q) => {
    const sd = statusLabelMap[q.status];
    return {
      id: q.id,
      name: q.name,
      buildingType: q.buildingType,
      area: q.area != null ? q.area.toLocaleString("ko-KR") : "-",
      modeCls: q.mode === "private" ? "badge-mode-private" : "badge-mode-public",
      modeLabel: q.mode === "private" ? "일반" : "공공입찰",
      amount: won(q.amount),
      statusCls: sd.cls,
      statusLabel: sd.label,
      date: q.date,
    };
  });

  const hasFilters = !!(status || buildingType || search);

  // 페이지당 5건 — 필터링된 rows 기준으로 페이지 수를 계산하고 현재 페이지를 clamp.
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => ({
    label: String(i + 1),
    activeCls: i === clampedPage ? "active" : "",
    pick: () => setPage(i),
  }));
  const pageRangeStart = rows.length === 0 ? 0 : clampedPage * PAGE_SIZE + 1;
  const pageRangeEnd = Math.min(rows.length, clampedPage * PAGE_SIZE + PAGE_SIZE);

  // KPI: 이번 달/지난달 견적 수·금액(생성일 기준), 진행 중 견적(상태 스냅샷, 월 무관).
  const thisMonthRows = quotes.filter((q) => q.monthKey === currentMonthKey);
  const prevMonthRows = quotes.filter((q) => q.monthKey === prevMonthKey);
  const thisMonthAmount = thisMonthRows.reduce((s, q) => s + q.amount, 0);
  const prevMonthAmount = prevMonthRows.reduce((s, q) => s + q.amount, 0);
  const openCount = quotes.filter((q) => q.status === "draft" || q.status === "sent").length;

  // 이번 달 상태 분포 — conic-gradient 도넛 + 범례.
  const total = thisMonthRows.length;
  const segDefs = [
    { key: "sent", label: "발송완료" },
    { key: "draft", label: "임시저장" },
    { key: "won", label: "수주성공" },
    { key: "lost", label: "수주실패" },
  ] as const;
  const counts = Object.fromEntries(segDefs.map((s) => [s.key, thisMonthRows.filter((q) => q.status === s.key).length]));
  const nonZero = segDefs.filter((s) => counts[s.key] > 0);
  // SVG 도넛 — 구간별로 정확한(반올림 없는) 비율을 누적해 stroke-dasharray/dashoffset을 계산한다.
  // 반올림은 범례 표시용 pct에서만 한다(legend와 동일하게).
  let cumPct = 0;
  const donutArcs = nonZero.map((s) => {
    const pct = (counts[s.key] / total) * 100;
    const arc = { key: s.key, label: s.label, count: counts[s.key], color: STATUS_COLORS[s.key], startPct: cumPct, pct };
    cumPct += pct;
    return arc;
  });
  const donutLegend = segDefs.map((s) => {
    const pct = total ? Math.round((counts[s.key] / total) * 100) : 0;
    return { label: s.label, count: counts[s.key], pct, dotStyle: { background: STATUS_COLORS[s.key] } };
  });

  // 이번 달 견적 금액 분포 — 실제 데이터 스케일(수십만~수백만원)에 맞춘 구간.
  const bucketDefs = [
    { label: "0~50만원", test: (a: number) => a < 500000 },
    { label: "50~100만원", test: (a: number) => a >= 500000 && a < 1000000 },
    { label: "100~200만원", test: (a: number) => a >= 1000000 && a < 2000000 },
    { label: "200만원 이상", test: (a: number) => a >= 2000000 },
  ];
  const amountBars = bucketDefs.map((b) => {
    const cnt = thisMonthRows.filter((q) => b.test(q.amount)).length;
    const pct = total ? Math.round((cnt / total) * 100) : 0;
    return { label: b.label, count: cnt, pct, fillStyle: { width: `${pct}%` } };
  });

  const emptyMessage = hasFilters ? "조건에 맞는 견적이 없습니다." : "아직 만든 견적이 없어요";
  const kpiCountDelta = fmtDeltaPill(total, prevMonthRows.length);
  const kpiAmountDelta = fmtDeltaPill(thisMonthAmount, prevMonthAmount);

  return (
    <>
      <h1 className="page-title">대시보드</h1>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label">이번 달 견적 수</span>
            <span className={`kpi-pill ${kpiCountDelta.dir}`}>
              {kpiCountDelta.dir === "up" ? "↑" : kpiCountDelta.dir === "down" ? "↓" : "–"} {kpiCountDelta.pct}%
            </span>
          </div>
          <div className="kpi-value num">{total}건</div>
          <span className="kpi-caption">지난달 {prevMonthRows.length}건</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label">진행 중 견적</span>
          </div>
          <div className="kpi-value num">{openCount}건</div>
          <span className="kpi-caption">임시저장 + 발송완료 합계</span>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <span className="kpi-label">이번 달 총 견적금액</span>
            <span className={`kpi-pill ${kpiAmountDelta.dir}`}>
              {kpiAmountDelta.dir === "up" ? "↑" : kpiAmountDelta.dir === "down" ? "↓" : "–"} {kpiAmountDelta.pct}%
            </span>
          </div>
          <div className="kpi-value num">{won(thisMonthAmount)}</div>
          <span className="kpi-caption">지난달 {won(prevMonthAmount)}</span>
        </div>
      </div>

      <div className="table-card">
        <h2 className="section-title">최근 견적 목록</h2>
        <div className="filters">
          <div className="filter-group">
            <span className="fl">현장명 검색</span>
            <input
              type="text"
              className="search-input"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="현장명으로 검색"
            />
          </div>
          <div className="filter-group">
            <span className="fl">상태</span>
            <div className="filter-pills">
              {statusPills.map((p) => (
                <button key={p.label} type="button" className="filter-pill" onClick={p.pick} style={p.style}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="fl">건물유형</span>
            <div className="filter-pills">
              {typePills.map((p) => (
                <button key={p.label} type="button" className="filter-pill" onClick={p.pick} style={p.style}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <div className="filter-actions">
              <button
                type="button"
                className="reset-link"
                onClick={() => { setStatus(""); setBuildingType(""); setSearch(""); setPage(0); }}
              >
                초기화
              </button>
            </div>
          )}
        </div>

        {rows.length > 0 ? (
          <>
            <table className="quote-table">
              <thead>
                <tr>
                  <th>현장명</th>
                  <th>건물유형</th>
                  <th className="amount">면적</th>
                  <th>모드</th>
                  <th className="amount">견적금액</th>
                  <th>상태</th>
                  <th>작성일</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((q) => (
                  <tr key={q.id} onClick={() => router.push(`/quotes/${q.id}`)}>
                    <td>
                      <Link href={`/quotes/${q.id}`} className="row-link" onClick={(e) => e.stopPropagation()}>
                        {q.name}
                      </Link>
                    </td>
                    <td>{q.buildingType}</td>
                    <td className="amount num">{q.area}㎡</td>
                    <td>
                      <span className={`badge ${q.modeCls}`}>{q.modeLabel}</span>
                    </td>
                    <td className="amount num">{q.amount}</td>
                    <td>
                      <span className={`badge ${q.statusCls}`}>{q.statusLabel}</span>
                    </td>
                    <td className="muted-cell">{q.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="pagination">
                <span className="page-summary">
                  전체 {rows.length}건 중 {pageRangeStart}-{pageRangeEnd}건
                </span>
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage(Math.max(0, clampedPage - 1))}
                  disabled={clampedPage === 0}
                >
                  이전
                </button>
                {pageNumbers.map((pn) => (
                  <button key={pn.label} type="button" className={`page-btn ${pn.activeCls}`} onClick={pn.pick}>
                    {pn.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="page-btn"
                  onClick={() => setPage(Math.min(totalPages - 1, clampedPage + 1))}
                  disabled={clampedPage === totalPages - 1}
                >
                  다음
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <p>{emptyMessage}</p>
            <Link className="btn btn-primary" href="/quotes/new">
              새 견적 만들기
            </Link>
          </div>
        )}
      </div>

      <div className="bottom-grid">
        <div className="chart-card">
          <h2 className="section-title">최근 활동</h2>
          <div className="activity-list">
            {activity.map((a, i) => (
              <div className="activity-row" key={i}>
                <span className="activity-dot" />
                <div className="activity-body">
                  <div className="activity-desc">{a.description}</div>
                  <div className="activity-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <h2 className="section-title">이번 달 견적 현황</h2>
          <div className="donut-wrap">
            <div className="donut">
              <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className="donut-svg">
                <g transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}>
                  <circle
                    cx={DONUT_SIZE / 2}
                    cy={DONUT_SIZE / 2}
                    r={DONUT_RADIUS}
                    fill="none"
                    stroke="var(--border-subtle)"
                    strokeWidth={DONUT_STROKE}
                  />
                  {donutArcs.map((arc, i) => {
                    const arcLen = (arc.pct / 100) * DONUT_CIRC;
                    const dashoffset = -(arc.startPct / 100) * DONUT_CIRC;
                    return (
                      <circle
                        key={arc.key}
                        cx={DONUT_SIZE / 2}
                        cy={DONUT_SIZE / 2}
                        r={DONUT_RADIUS}
                        fill="none"
                        stroke={arc.color}
                        strokeWidth={DONUT_STROKE}
                        strokeDashoffset={dashoffset}
                        strokeDasharray={donutAnimated ? `${arcLen} ${DONUT_CIRC - arcLen}` : `0 ${DONUT_CIRC}`}
                        className={`donut-seg ${hoveredStatus === arc.key ? "is-hovered" : ""}`}
                        style={{
                          transformOrigin: `${DONUT_SIZE / 2}px ${DONUT_SIZE / 2}px`,
                          transition: `stroke-dasharray .9s var(--ease) ${i * 0.06}s, transform .2s ease, filter .2s ease`,
                        }}
                        onMouseEnter={() => setHoveredStatus(arc.key)}
                        onMouseLeave={() => setHoveredStatus(null)}
                      />
                    );
                  })}
                </g>
              </svg>
              <div className="donut-center">
                <div className={`donut-center-face ${hoveredStatus ? "" : "is-visible"}`}>
                  <span className="n num">{total}</span>
                  <span className="l">건</span>
                </div>
                {donutArcs.map((arc) => (
                  <div key={arc.key} className={`donut-center-face ${hoveredStatus === arc.key ? "is-visible" : ""}`}>
                    <span className="n num">{arc.count}</span>
                    <span className="l">{arc.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="legend">
              {donutLegend.map((l, i) => (
                <div className="legend-row" key={l.label} style={{ animationDelay: `${i * 0.08}s` }}>
                  <span className="legend-dot" style={l.dotStyle} />
                  <span className="legend-label">{l.label}</span>
                  <span className="legend-value num">
                    {l.count}건 ({l.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-divider" />
          <h2 className="section-title">견적 금액별 현황</h2>
          <div className="bars">
            {amountBars.map((b) => (
              <div className="bar-row" key={b.label}>
                <div className="bar-head">
                  <span className="lbl">{b.label}</span>
                  <span className="val num">
                    {b.count}건 ({b.pct}%)
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={b.fillStyle} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
