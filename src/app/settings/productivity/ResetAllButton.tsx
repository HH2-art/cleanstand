"use client";

import { useState, useTransition } from "react";
import { resetAllProductivityOverrides } from "@/app/actions/productivity";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function ResetAllButton() {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function confirmReset() {
    startTransition(() => {
      resetAllProductivityOverrides();
    });
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="btn-outline neutral" onClick={() => setOpen(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
        기본값으로 되돌리기
      </button>
      <ConfirmDialog
        open={open}
        title="기본값으로 되돌리기"
        description="업계 기본값 8종에 설정한 회사 커스텀값을 모두 지우고 기본값으로 되돌릴까요? 회사가 직접 추가한 작업유형은 영향받지 않습니다."
        confirmLabel="되돌리기"
        onConfirm={confirmReset}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
