"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";

const initialState: AuthActionState = null;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <AuthShell>
      <h1 className="auth-title animate-element animate-delay-100">
        클린스탠드 계정으로
        <br />
        로그인하세요
      </h1>
      <p className="auth-subtitle animate-element animate-delay-200">청소 견적 계산과 관리를 계속하려면 로그인하세요.</p>

      <form action={formAction} className="auth-form">
        <div className="auth-field animate-element animate-delay-300">
          <label htmlFor="email" className="auth-label">
            이메일
          </label>
          <div className="glass-input-wrapper">
            <input id="email" name="email" type="email" required autoComplete="email" className="auth-input" />
          </div>
        </div>

        <div className="auth-field animate-element animate-delay-400">
          <label htmlFor="password" className="auth-label">
            비밀번호
          </label>
          <PasswordInput id="password" name="password" autoComplete="current-password" />
        </div>

        {state && "error" in state && (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={isPending} className="auth-submit animate-element animate-delay-500">
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="auth-footer animate-element animate-delay-600">
        계정이 없으신가요? <Link href="/signup">회원가입</Link>
      </p>
    </AuthShell>
  );
}
