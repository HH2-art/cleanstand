"use client";

import { useActionState } from "react";
import type { ExpenseActionState } from "@/app/actions/expenses";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./labels";

const initialState: ExpenseActionState = null;

export interface ExpenseFormValues {
  id?: string;
  name?: string;
  category?: string;
  unit_cost?: number;
  note?: string | null;
}

export function ExpenseForm({
  action,
  defaultValues,
  submitLabel,
  layout = "add",
}: {
  action: (state: ExpenseActionState, formData: FormData) => Promise<ExpenseActionState>;
  defaultValues?: ExpenseFormValues;
  submitLabel: string;
  layout?: "add" | "edit";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={layout === "add" ? "add-form" : "edit-form"}>
      {defaultValues?.id && <input type="hidden" name="id" defaultValue={defaultValues.id} />}

      <div className={`field ${layout === "add" ? "grow" : ""}`}>
        <label htmlFor="name">항목명</label>
        <input id="name" name="name" type="text" required defaultValue={defaultValues?.name} />
      </div>

      <div className="field">
        <label htmlFor="category">구분</label>
        <select id="category" name="category" defaultValue={defaultValues?.category ?? CATEGORY_ORDER[0]}>
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="unit_cost">금액 (원)</label>
        <input id="unit_cost" name="unit_cost" type="number" defaultValue={defaultValues?.unit_cost ?? 0} />
      </div>

      <div className={`field ${layout === "add" ? "grow" : ""}`}>
        <label htmlFor="note">비고</label>
        <input id="note" name="note" type="text" defaultValue={defaultValues?.note ?? ""} placeholder="선택 입력" />
      </div>

      {state && "error" in state && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
