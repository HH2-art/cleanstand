"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { upsertCompanyRow } from "@/lib/company";

export type AuthActionState = { error: string } | { success: true } | null;

/**
 * 회사명을 여기서 함께 받아 signUp 성공 직후 companies row까지 만든다(재사용:
 * upsertCompanyRow, src/lib/company.ts — 회사 설정 화면의 upsertCompany와 같은 로직).
 *
 * 문제는 타이밍이다 — RLS 정책 companies_insert_own은 owner_id = auth.uid()를
 * 요구하는데, 이메일 인증이 필요한 프로젝트 설정(이 화면이 "이메일을 확인해주세요"
 * 화면으로 분기하는 것으로 보아 현재 그렇게 켜져 있다)에서는 signUp()이 세션을
 * 만들어주지 않는다(data.session이 null) — 이 요청 안에서는 아직 "로그인된 사용자"가
 * 없어서 지금 바로 insert를 시도해도 RLS가 막는다(서비스 롤 키는 이 프로젝트에 없어서
 * RLS를 우회할 방법도 없다).
 *
 * 그래서 두 경로로 나눈다:
 *  - data.session이 있으면(이메일 인증이 꺼져 있는 등 드문 경우) 이 요청 안에서 바로
 *    회사를 만든다.
 *  - 없으면(현재의 일반적인 흐름) 회사명을 auth 유저의 user_metadata에 실어 보내고,
 *    실제 생성은 이메일 링크를 눌러 세션이 진짜로 생기는 시점(/auth/callback,
 *    exchangeCodeForSession 직후)으로 미룬다 — 거기서는 인증된 세션이 있어 RLS를
 *    통과한다. 그 시점부터는 이미 회사가 있으니 로그인 시 requireCurrentCompany()가
 *    /settings/company로 돌려보내지 않고 /dashboard가 바로 뜬다.
 */
export async function signUp(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("company_name") ?? "").trim();

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }
  if (!companyName) {
    return { error: "회사명을 입력해주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
      data: { company_name: companyName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.session && data.user) {
    const result = await upsertCompanyRow(supabase, { ownerId: data.user.id, name: companyName });
    if ("error" in result) return { error: result.error };
  }

  return { success: true };
}

export async function signIn(_prevState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
