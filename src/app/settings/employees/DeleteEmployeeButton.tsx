"use client";

import { deleteEmployee } from "@/app/actions/employees";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteEmployee}
      onSubmit={(e) => {
        if (!confirm(`${name} 직원을 정말 삭제하시겠어요?`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="ml-3 text-xs text-red-600 underline">
        삭제
      </button>
    </form>
  );
}
