"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "@/app/actions/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";

const initialState: UpdatePasswordState = null;

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, initialState);

  if (state && "success" in state) {
    return (
      <>
        <div className="auth-icon-circle animate-element animate-delay-100" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="auth-title animate-element animate-delay-200">비밀번호가 변경되었습니다</h1>
        <p className="auth-subtitle animate-element animate-delay-300">새 비밀번호로 다시 로그인해주세요.</p>
        <p className="auth-footer animate-element animate-delay-400">
          <Link href="/login">로그인 페이지로 이동</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title animate-element animate-delay-100">
        새 비밀번호를
        <br />
        설정하세요
      </h1>
      <p className="auth-subtitle animate-element animate-delay-200">계정에 사용할 새 비밀번호를 입력해주세요.</p>

      <form action={formAction} className="auth-form">
        <div className="auth-field animate-element animate-delay-300">
          <label htmlFor="password" className="auth-label">
            새 비밀번호
          </label>
          <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} />
          <p className="auth-hint">8자 이상</p>
        </div>

        {state && "error" in state && (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="auth-submit animate-element animate-delay-400">
          {isPending ? "변경 중..." : "비밀번호 변경"}
        </button>
      </form>
    </>
  );
}
