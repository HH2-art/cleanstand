"use client";

import { useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { updateQuoteStatus } from "@/app/actions/quotes";

// 실제 schema.sql check 제약과 동일: quotes.status in ('draft','sent','won','lost').
// 라벨/활성 스타일은 디자인 캔버스(Main.dc.html)의 STATUS_DEF를 그대로 옮겼다.
const STATUS_DEF: { value: string; label: string; activeStyle: CSSProperties }[] = [
  { value: "draft", label: "임시저장", activeStyle: { background: "var(--surface-subtle)", color: "var(--text-secondary)", fontWeight: 600 } },
  { value: "sent", label: "발송완료", activeStyle: { background: "var(--brand-subtle)", color: "var(--brand)", fontWeight: 600 } },
  { value: "won", label: "수주성공", activeStyle: { background: "var(--success-subtle)", color: "var(--success)", fontWeight: 600 } },
  { value: "lost", label: "수주실패", activeStyle: { background: "var(--error-subtle)", color: "var(--error)", fontWeight: 600 } },
];

const PENDING_STYLE: CSSProperties = { boxShadow: "inset 0 0 0 2px var(--brand)", color: "var(--text)", fontWeight: 600 };

/**
 * 상태 변경 영역 — 디자인 캔버스의 세그먼트 필(pill) 컨트롤을 그대로 포팅.
 * 필을 고르는 것과 실제로 저장되는 것을 분리한다(committedStatus vs
 * selectedStatus) — "변경" 버튼을 눌러야만 실제 updateQuoteStatus 서버 액션이
 * 나간다. rightSlot은 상태와 같은 줄 제일 우측에 놓일 "수정" 버튼 자리
 * (draft일 때만 보이는지는 서버 컴포넌트인 부모가 이미 판단해서 넘겨준다).
 */
export function QuoteStatusControl({
  quoteId,
  status,
  rightSlot,
}: {
  quoteId: string;
  status: string;
  rightSlot?: ReactNode;
}) {
  const [committedStatus, setCommittedStatus] = useState(status);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [, startTransition] = useTransition();
  const isDirty = selectedStatus !== committedStatus;

  function commit() {
    const fd = new FormData();
    fd.set("id", quoteId);
    fd.set("status", selectedStatus);
    startTransition(() => {
      updateQuoteStatus(fd);
    });
    setCommittedStatus(selectedStatus);
  }

  return (
    <div className="status-block">
      <div className="status-label">상태</div>
      <div className="status-row">
        <div className="status-pill">
          {STATUS_DEF.map((d) => {
            const isCommitted = committedStatus === d.value;
            const isSelected = selectedStatus === d.value;
            const style = isSelected && isDirty ? PENDING_STYLE : isCommitted ? d.activeStyle : undefined;
            return (
              <button key={d.value} type="button" style={style} onClick={() => setSelectedStatus(d.value)}>
                {d.label}
              </button>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary" onClick={commit} disabled={!isDirty}>
          변경
        </button>
        {rightSlot}
      </div>
      {isDirty && <p className="status-hint">선택한 상태가 아직 저장되지 않았습니다 — 변경 버튼을 눌러야 반영됩니다.</p>}
    </div>
  );
}
