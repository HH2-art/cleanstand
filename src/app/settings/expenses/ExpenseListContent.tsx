"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleExpenseItemActive, type ExpenseCategory } from "@/app/actions/expenses";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./labels";
import { ExpenseCategoryIcon } from "./ExpenseCategoryIcon";
import { DeleteExpenseItemButton } from "./DeleteExpenseItemButton";

export interface ExpenseRow {
  id: string;
  name: string;
  category: ExpenseCategory;
  unitCost: number;
  isActive: boolean;
  note: string | null;
  registeredDate: string; // "YYYY.MM.DD", formatted server-side from created_at
}

const PAGE_SIZE = 10;

function StatusToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <label className="status-toggle">
      <input
        type="checkbox"
        checked={isActive}
        onChange={() => startTransition(() => toggleExpenseItemActive(id, !isActive))}
      />
      <span className="track" />
      <span className="thumb" />
    </label>
  );
}

/**
 * 경비 항목 목록 — 직원관리 캔버스에서 확립된 검색/페이지네이션 패턴을 그대로 재사용
 * (서버가 회사 전체 경비항목을 한 번에 내려주고, 검색/구분필터/사용여부필터/페이지는
 * 여기서 클라이언트 사이드로 처리). 사용여부 토글·삭제는 실제 서버 액션을 그대로 호출.
 */
export function ExpenseListContent({ items }: { items: ExpenseRow[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "all">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(0);

  const searchTerm = search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm)) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (activeFilter === "active" && !item.isActive) return false;
    if (activeFilter === "inactive" && item.isActive) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  return (
    <div className="card">
      <div className="list-head">
        <div className="list-head-title">
          <h2>경비 항목 목록</h2>
          <p>총 {items.length}개의 경비 항목이 등록되어 있습니다.</p>
        </div>
        <div className="list-filters">
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            placeholder="항목명으로 검색하세요..."
          />
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(e) => resetToFirstPage(setCategoryFilter)(e.target.value as ExpenseCategory | "all")}
          >
            <option value="all">전체 구분</option>
            {CATEGORY_ORDER.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={activeFilter}
            onChange={(e) => resetToFirstPage(setActiveFilter)(e.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">사용 여부</option>
            <option value="active">사용중</option>
            <option value="inactive">미사용</option>
          </select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <table className="exp-table">
            <thead>
              <tr>
                <th>구분</th>
                <th>항목명</th>
                <th className="num">금액</th>
                <th>사용여부</th>
                <th>등록일</th>
                <th>비고</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((item) => (
                <tr key={item.id} className={item.isActive ? "" : "inactive"}>
                  <td>
                    <div className="wt-row">
                      <span className="wt-icon">
                        <ExpenseCategoryIcon category={item.category} />
                      </span>
                      <span className="wt-name">{CATEGORY_LABELS[item.category]}</span>
                    </div>
                  </td>
                  <td>{item.name}</td>
                  <td className="num">{item.unitCost.toLocaleString()}원</td>
                  <td>
                    <StatusToggle id={item.id} isActive={item.isActive} />
                  </td>
                  <td className="muted-cell">{item.registeredDate}</td>
                  <td className="muted-cell">{item.note || "—"}</td>
                  <td className="actions">
                    <Link href={`/settings/expenses/${item.id}`} className="btn-text">
                      수정
                    </Link>
                    <DeleteExpenseItemButton id={item.id} name={item.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination">
              <span className="page-summary">총 {filtered.length}개 항목 중 {pageRows.length}개 표시</span>
              <button
                type="button"
                className="page-btn"
                onClick={() => setPage(Math.max(0, clampedPage - 1))}
                disabled={clampedPage === 0}
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`page-btn ${i === clampedPage ? "active" : ""}`}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
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
        <p className="empty-hint">{searchTerm || categoryFilter !== "all" || activeFilter !== "all" ? "검색 결과가 없습니다." : "등록된 경비 항목이 없습니다."}</p>
      )}
    </div>
  );
}
