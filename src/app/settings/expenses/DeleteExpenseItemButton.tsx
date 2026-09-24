"use client";

import { useState, useTransition } from "react";
import { deleteExpenseItem } from "@/app/actions/expenses";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function DeleteExpenseItemButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function confirmDelete() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(() => {
      deleteExpenseItem(fd);
    });
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="btn-text danger" onClick={() => setOpen(true)}>
        삭제
      </button>
      <ConfirmDialog
        open={open}
        title="경비 항목 삭제"
        description={`"${name}" 경비 항목을 정말 삭제하시겠어요?`}
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
