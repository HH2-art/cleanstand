"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { upsertCompany, type CompanyActionState } from "@/app/actions/company";
import type { Company } from "@/lib/company";

const initialState: CompanyActionState = null;

export function CompanyForm({ company }: { company: Company | null }) {
  const [state, formAction, isPending] = useActionState(upsertCompany, initialState);
  const [name, setName] = useState(company?.name ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const logoSrc = logoPreview ?? company?.logo_url ?? null;
  const logoInitial = name.trim().charAt(0) || "?";

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="company-page company-container">
      <form action={formAction}>
        <div className="page-head-row">
          <div className="page-head">
            <span className="crumb">회사설정</span>
            <h1>회사정보 및 설정</h1>
            <p>{company ? "회사 기본 정보와 견적 기준 설정을 관리합니다." : "먼저 회사 정보를 등록해주세요."}</p>
          </div>
          <button type="submit" className="btn btn-primary save-btn" disabled={isPending}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {isPending ? "저장 중..." : "저장하기"}
          </button>
        </div>

        {state && "error" in state && (
          <p className="form-msg error" role="alert">
            {state.error}
          </p>
        )}
        {state && "success" in state && <p className="form-msg success">저장되었습니다.</p>}

        <div className="card">
          <h2>회사 기본정보</h2>
          <div className="company-info-row">
            <div className="logo-col">
              <div className="logo-square">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoSrc} alt="로고 미리보기" />
                ) : (
                  <span className="ph">{logoInitial}</span>
                )}
              </div>
              <input type="hidden" name="existing_logo_url" defaultValue={company?.logo_url ?? ""} />
              <input
                ref={fileInputRef}
                type="file"
                id="logo"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={onLogoChange}
                style={{ display: "none" }}
              />
              <button type="button" className="logo-change-btn" onClick={() => fileInputRef.current?.click()}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                로고 변경
              </button>
              <span className="logo-hint">
                {logoPreview ? "새로 선택한 로고 (저장 시 반영)" : "PNG, JPG, WEBP, SVG · 5MB 이하"}
              </span>
            </div>

            <div className="fields-col">
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="name">
                    회사명 <span className="req">*</span>
                  </label>
                  <input id="name" name="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="representative_name">대표자명</label>
                  <input id="representative_name" name="representative_name" type="text" defaultValue={company?.representative_name ?? ""} />
                </div>
              </div>
              <div className="field-grid">
                <div className="field">
                  <label htmlFor="business_registration_number">사업자등록번호</label>
                  <input
                    id="business_registration_number"
                    name="business_registration_number"
                    type="text"
                    defaultValue={company?.business_registration_number ?? ""}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">연락처</label>
                  <input id="phone" name="phone" type="tel" defaultValue={company?.phone ?? ""} placeholder="02-1234-5678" />
                </div>
              </div>
              <div className="field-grid single">
                <div className="field">
                  <label htmlFor="address">주소</label>
                  <input id="address" name="address" type="text" defaultValue={company?.address ?? ""} />
                </div>
              </div>

              <p className="subsection-label">비밀번호 변경</p>
              <div className="field-grid" style={{ marginBottom: 0 }}>
                <div className="field">
                  <input type="password" name="new_password" placeholder="새 비밀번호를 입력하세요" autoComplete="new-password" />
                </div>
                <div className="field">
                  <input type="password" name="confirm_password" placeholder="비밀번호 확인" autoComplete="new-password" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header-row">
            <span className="card-icon">%</span>
            <div>
              <h2>기본 요율</h2>
              <p className="card-subcopy">견적 계산에 사용되는 기본 요율을 설정합니다.</p>
            </div>
          </div>
          <div className="rate-row">
            <div className="field">
              <label htmlFor="general_admin_rate">일반관리비율</label>
              <div className="pct-field-wrap">
                <input
                  id="general_admin_rate"
                  name="general_admin_rate"
                  type="number"
                  step="0.01"
                  defaultValue={company?.general_admin_rate ?? 9}
                />
                <span className="pct-suffix">%</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="profit_rate">이윤율</label>
              <div className="pct-field-wrap">
                <input id="profit_rate" name="profit_rate" type="number" step="0.01" defaultValue={company?.profit_rate ?? 10} />
                <span className="pct-suffix">%</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="vat_rate">부가세율</label>
              <div className="pct-field-wrap">
                <input id="vat_rate" name="vat_rate" type="number" step="0.01" defaultValue={company?.vat_rate ?? 10} />
                <span className="pct-suffix">%</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
