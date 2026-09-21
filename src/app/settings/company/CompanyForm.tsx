"use client";

import { useActionState } from "react";
import { upsertCompany, type CompanyActionState } from "@/app/actions/company";
import type { Company } from "@/lib/company";

const initialState: CompanyActionState = null;

export function CompanyForm({ company }: { company: Company | null }) {
  const [state, formAction, isPending] = useActionState(upsertCompany, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="회사명 *" name="name" defaultValue={company?.name} required />
      <Field label="대표자명" name="representative_name" defaultValue={company?.representative_name ?? ""} />
      <Field
        label="사업자등록번호"
        name="business_registration_number"
        defaultValue={company?.business_registration_number ?? ""}
      />
      <Field label="주소" name="address" defaultValue={company?.address ?? ""} />
      <Field label="연락처" name="phone" type="tel" defaultValue={company?.phone ?? ""} placeholder="02-1234-5678" />

      <div className="grid grid-cols-3 gap-4">
        <Field
          label="일반관리비율 (%)"
          name="general_admin_rate"
          type="number"
          step="0.01"
          defaultValue={company?.general_admin_rate ?? 9}
        />
        <Field
          label="이윤율 (%)"
          name="profit_rate"
          type="number"
          step="0.01"
          defaultValue={company?.profit_rate ?? 10}
        />
        <Field label="VAT율 (%)" name="vat_rate" type="number" step="0.01" defaultValue={company?.vat_rate ?? 10} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="logo" className="text-sm font-medium">
          로고 이미지
        </label>
        {company?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo_url} alt="현재 로고" className="h-12 w-auto object-contain" />
        )}
        <input type="hidden" name="existing_logo_url" defaultValue={company?.logo_url ?? ""} />
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="text-sm"
        />
        <p className="text-xs text-gray-400">PNG, JPG, WEBP, SVG · 5MB 이하. 새로 고르지 않으면 기존 로고가 유지됩니다.</p>
      </div>

      {state && "error" in state && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state && "success" in state && <p className="text-sm text-green-600">저장되었습니다.</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  step,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
      />
    </div>
  );
}
