"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = null;

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  if (state && "success" in state) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold">이메일을 확인해주세요</h1>
        <p className="text-sm text-gray-500">
          가입하신 이메일로 인증 링크를 보냈습니다. 링크를 눌러 인증을 완료하면 로그인할 수 있습니다.
        </p>
        <Link href="/login" className="mt-2 text-sm font-medium text-black underline">
          로그인 페이지로 이동
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">회원가입</h1>
        <p className="mt-1 text-sm text-gray-500">Cleanstand 계정을 만드세요.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
          <p className="text-xs text-gray-400">8자 이상</p>
        </div>

        {state && "error" in state && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "가입 중..." : "회원가입"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-medium text-black underline">
          로그인
        </Link>
      </p>
    </main>
  );
}
