"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteEmployee } from "@/app/actions/employees";

export interface EmployeeRow {
  id: string;
  name: string;
  role: string;
  monthlyWorkHours: number;
  active: boolean;
  joinedDate: string; // "YYYY.MM.DD", formatted server-side from created_at
}

const PAGE_SIZE = 5;

/**
 * 직원 목록 — 캔버스의 검색/페이지네이션/인라인 삭제확인 로직을 그대로 이식했다
 * (대시보드 캔버스 포팅 때 쓴 것과 동일한 패턴: 서버가 회사 전체 직원을 한 번에
 * 내려주고, 검색/페이지는 여기서 클라이언트 사이드로 처리). 삭제 자체는 실제
 * deleteEmployee 서버 액션을 그대로 호출한다 — 기존 confirm() 다이얼로그 대신
 * 캔버스처럼 행 안에서 "정말 삭제할까요? 예/아니오"로 확인한다.
 */
export function EmployeeListContent({ employees }: { employees: EmployeeRow[] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const searchTerm = search.trim().toLowerCase();
  const filtered = employees.filter((e) => {
    if (!searchTerm) return true;
    return e.name.toLowerCase().includes(searchTerm) || e.role.toLowerCase().includes(searchTerm);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE);

  function confirmDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteEmployee(fd);
    });
    setConfirmingId(null);
  }

  return (
    <div className="card">
      <div className="list-head">
        <h2>직원 목록</h2>
        <input
          type="text"
          className="search-input"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="이름 또는 역할로 검색..."
        />
      </div>
      {filtered.length > 0 ? (
        <>
          <table className="emp-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>역할</th>
                <th>월 투입시간</th>
                <th>재직</th>
                <th>등록일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((e) => (
                <tr key={e.id} className={e.active ? "" : "inactive"}>
                  <td>{e.name}</td>
                  <td>{e.role}</td>
                  <td className="num">{e.monthlyWorkHours}h</td>
                  <td>
                    <span className={`badge ${e.active ? "badge-active" : "badge-inactive"}`}>
                      {e.active ? "재직중" : "퇴사"}
                    </span>
                    {!e.active && <span className="excluded-tag">— 표준원가 계산 제외</span>}
                  </td>
                  <td className="muted-cell">{e.joinedDate}</td>
                  <td className="actions">
                    {confirmingId === e.id ? (
                      <>
                        <span className="confirm-text">정말 삭제할까요?</span>
                        <button type="button" className="btn-text" onClick={() => confirmDelete(e.id)}>
                          예
                        </button>
                        <button type="button" className="btn-text muted" onClick={() => setConfirmingId(null)}>
                          아니오
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href={`/settings/employees/${e.id}`}>수정</Link>
                        <button type="button" className="del" onClick={() => setConfirmingId(e.id)}>
                          삭제
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="pagination">
              <span className="page-summary">전체 {filtered.length}명</span>
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
        <p className="empty-hint">{searchTerm ? "검색 결과가 없습니다." : "등록된 직원이 없습니다."}</p>
      )}
    </div>
  );
}
