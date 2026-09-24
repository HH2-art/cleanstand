"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp, type AuthActionState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";

const initialState: AuthActionState = null;

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);
  // 성공 화면에 "입력하신 이메일" 표시용 — signUp 액션의 성공 상태엔 이메일이
  // 안 담겨 있어서(전환 로직은 안 건드리는 게 원칙이라 그대로), 제출 시점의
  // 입력값만 따로 로컬로 기억해둔다. action={formAction}과 이 onSubmit은 같이
  // 붙을 수 있고, 여기서 preventDefault를 안 하므로 실제 제출 흐름엔 영향 없다.
  const [submittedEmail, setSubmittedEmail] = useState("");

  if (state && "success" in state) {
    return (
      <AuthShell>
        <div className="auth-icon-circle animate-element animate-delay-100" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
        </div>
        <h1 className="auth-title animate-element animate-delay-200">이메일을 확인해주세요</h1>
        <p className="auth-subtitle animate-element animate-delay-300">
          가입하신 이메일로 인증 링크를 보내드렸어요. 링크를 클릭하면 바로 시작할 수 있어요.
        </p>
        {submittedEmail && (
          <div className="glass-input-wrapper animate-element animate-delay-400">
            <p className="auth-email-chip">{submittedEmail}</p>
          </div>
        )}
        <p className="auth-footer animate-element animate-delay-500">
          <Link href="/login">로그인 페이지로 이동</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="auth-title animate-element animate-delay-100">
        클린스탠드 계정을
        <br />
        만드세요
      </h1>
      <p className="auth-subtitle animate-element animate-delay-200">몇 가지 정보만 입력하면 바로 시작할 수 있어요.</p>

      <form
        action={formAction}
        className="auth-form"
        onSubmit={(e) => setSubmittedEmail(String(new FormData(e.currentTarget).get("email") ?? ""))}
      >
        <div className="auth-field animate-element animate-delay-300">
          <label htmlFor="company_name" className="auth-label">
            회사명
          </label>
          <div className="glass-input-wrapper">
            <input
              id="company_name"
              name="company_name"
              type="text"
              required
              autoComplete="organization"
              className="auth-input"
            />
          </div>
        </div>

        <div className="auth-field animate-element animate-delay-400">
          <label htmlFor="email" className="auth-label">
            이메일
          </label>
          <div className="glass-input-wrapper">
            <input id="email" name="email" type="email" required autoComplete="email" className="auth-input" />
          </div>
        </div>

        <div className="auth-field animate-element animate-delay-500">
          <label htmlFor="password" className="auth-label">
            비밀번호
          </label>
          <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
          <p className="auth-hint">8자 이상</p>
        </div>

        {state && "error" in state && (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="auth-submit animate-element animate-delay-600">
          {isPending ? "가입 중..." : "회원가입"}
        </button>
      </form>

      <p className="auth-footer animate-element animate-delay-700">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </AuthShell>
  );
}
