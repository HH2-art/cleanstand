"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = null;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold">로그인</h1>
        <p className="mt-1 text-sm text-gray-500">Cleanstand 계정으로 로그인하세요.</p>
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
            autoComplete="current-password"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
          />
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
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="font-medium text-black underline">
          회원가입
        </Link>
      </p>
    </main>
  );
}
