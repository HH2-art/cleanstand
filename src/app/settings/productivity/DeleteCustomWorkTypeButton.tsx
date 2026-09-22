"use client";

import { deleteCustomWorkType } from "@/app/actions/productivity";

export function DeleteCustomWorkTypeButton({ workType, name }: { workType: string; name: string }) {
  return (
    <form
      action={deleteCustomWorkType}
      onSubmit={(e) => {
        if (!confirm(`"${name}" 작업유형을 정말 삭제하시겠어요?`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="work_type" value={workType} />
      <button type="submit" className="btn-text danger">
        삭제
      </button>
    </form>
  );
}
