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
}

export function ExpenseForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: ExpenseActionState, formData: FormData) => Promise<ExpenseActionState>;
  defaultValues?: ExpenseFormValues;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {defaultValues?.id && <input type="hidden" name="id" defaultValue={defaultValues.id} />}

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          항목명
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category" className="text-sm font-medium">
          카테고리
        </label>
        <select
          id="category"
          name="category"
          defaultValue={defaultValues?.category ?? CATEGORY_ORDER[0]}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="unit_cost" className="text-sm font-medium">
          단가 (원)
        </label>
        <input
          id="unit_cost"
          name="unit_cost"
          type="number"
          defaultValue={defaultValues?.unit_cost ?? 0}
          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {state && "error" in state && (
        <p className="w-full text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "저장 중..." : submitLabel}
      </button>
    </form>
  );
}
