"use client";

import { resetAllProductivityOverrides } from "@/app/actions/productivity";

export function ResetAllButton() {
  return (
    <form
      action={resetAllProductivityOverrides}
      onSubmit={(e) => {
        if (!confirm("업계 기본값 8종에 설정한 회사 커스텀값을 모두 지우고 기본값으로 되돌릴까요? 회사가 직접 추가한 작업유형은 영향받지 않습니다.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600">
        기본값으로 되돌리기
      </button>
    </form>
  );
}
