"use client";

import { useActionState } from "react";
import type { EmployeeActionState } from "@/app/actions/employees";
import "./employees.css";

const initialState: EmployeeActionState = null;

export interface EmployeeFormValues {
  id?: string;
  name?: string;
  role?: string;
  base_salary?: number;
  annual_leave_allowance?: number;
  retirement_provision?: number;
  insurance_burden?: number;
  other_company_cost?: number;
  monthly_work_hours?: number;
  active?: boolean;
}

export function EmployeeForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: EmployeeActionState, formData: FormData) => Promise<EmployeeActionState>;
  defaultValues?: EmployeeFormValues;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="form-body">
      {defaultValues?.id && <input type="hidden" name="id" defaultValue={defaultValues.id} />}

      <div className="field-grid">
        <Field label="이름" name="name" defaultValue={defaultValues?.name} required />
        <Field label="역할" name="role" defaultValue={defaultValues?.role} required placeholder="예: 일반청소원, 반장" />
      </div>

      <div className="field-grid">
        <Field label="기본급 (월, 원)" name="base_salary" type="number" defaultValue={defaultValues?.base_salary ?? 0} />
        <Field
          label="연차수당 (월, 원)"
          name="annual_leave_allowance"
          type="number"
          defaultValue={defaultValues?.annual_leave_allowance ?? 0}
        />
        <Field
          label="퇴직관련비용 (월, 원)"
          name="retirement_provision"
          type="number"
          defaultValue={defaultValues?.retirement_provision ?? 0}
        />
        <Field
          label="4대보험 회사부담 (월, 원)"
          name="insurance_burden"
          type="number"
          defaultValue={defaultValues?.insurance_burden ?? 0}
        />
        <Field
          label="기타 회사부담비용 (월, 원)"
          name="other_company_cost"
          type="number"
          defaultValue={defaultValues?.other_company_cost ?? 0}
        />
        <Field
          label="월 투입 가능시간"
          name="monthly_work_hours"
          type="number"
          defaultValue={defaultValues?.monthly_work_hours ?? 209}
        />
      </div>

      <div className="form-footer">
        <label className="check-row">
          <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} />
          재직중 (해제하면 표준원가 계산에서 제외)
        </label>

        {state && "error" in state && (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="btn btn-primary">
          {isPending ? "저장 중..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>
        {label} {required && <span className="req">*</span>}
      </label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} />
    </div>
  );
}
