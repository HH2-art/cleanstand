"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/AuthShell";

const initialState: ForgotPasswordState = null;

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);
  // 성공 화면에 "입력하신 이메일" 표시용 — signup 성공 화면과 같은 패턴(액션은
  // 보안상 이메일을 응답에 안 실어 보내므로, 제출 시점의 입력값만 로컬로 기억).
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
          입력하신 이메일 주소로 비밀번호 재설정 링크를 보내드렸어요. 계정이 존재하는 경우에만 메일이 도착하니, 받은
          메일이 없다면 스팸함도 확인해주세요.
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
        비밀번호를
        <br />
        재설정하세요
      </h1>
      <p className="auth-subtitle animate-element animate-delay-200">
        가입하신 이메일 주소를 입력하시면 재설정 링크를 보내드려요.
      </p>

      <form
        action={formAction}
        className="auth-form"
        onSubmit={(e) => setSubmittedEmail(String(new FormData(e.currentTarget).get("email") ?? ""))}
      >
        <div className="auth-field animate-element animate-delay-300">
          <label htmlFor="email" className="auth-label">
            이메일
          </label>
          <div className="glass-input-wrapper">
            <input id="email" name="email" type="email" required autoComplete="email" className="auth-input" />
          </div>
        </div>

        {state && "error" in state && (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="auth-submit animate-element animate-delay-400">
          {isPending ? "전송 중..." : "재설정 링크 보내기"}
        </button>
      </form>

      <p className="auth-footer animate-element animate-delay-500">
        <Link href="/login">로그인 페이지로 돌아가기</Link>
      </p>
    </AuthShell>
  );
}
