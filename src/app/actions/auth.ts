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

export type ForgotPasswordState = { success: true } | { error: string } | null;

/**
 * 비밀번호 재설정 메일 발송 — signIn/signUp과 별개의 흐름이라 그쪽 로직은 전혀
 * 건드리지 않는다. 링크는 기존 /auth/callback을 그대로 거치되, redirectTo로
 * /reset-password를 지정해 거기로 보낸다(콜백 라우트 자체는 무수정 — 회사
 * 자동생성 블록은 이미 "회사가 있으면 건드리지 않음" 가드가 있어서, 기존
 * 유저가 비밀번호를 재설정하며 이 콜백을 다시 타도 아무 영향이 없다).
 *
 * 보안: 존재하지 않는 이메일이어도 항상 같은 성공 문구를 보여준다(계정 존재
 * 여부를 노출하지 않기 위해) — resetPasswordForEmail 자체도 이 원칙대로 동작해서
 * "계정 없음" 에러를 던지지 않는다. 레이트리밋 등 무관한 에러만 서버 로그에
 * 남기고, 클라이언트에는 그래도 항상 success를 반환한다.
 */
export async function requestPasswordReset(_prevState: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "이메일을 입력해주세요." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?redirectTo=${encodeURIComponent("/reset-password")}`,
  });
  if (error) {
    console.error("[requestPasswordReset] resetPasswordForEmail failed:", error.message);
  }

  return { success: true };
}

export type UpdatePasswordState = { success: true } | { error: string } | null;

/**
 * 새 비밀번호 저장 — /reset-password 페이지에서만 호출된다. 이 시점엔 이메일의
 * 재설정 링크를 눌러 /auth/callback의 exchangeCodeForSession을 이미 거친
 * 뒤라(콜백은 무수정) 인증된(recovery) 세션이 있어야 한다; 없으면(링크 만료 등)
 * 에러로 막는다. 성공 후에는 새 비밀번호로 다시 로그인하도록 세션을 끊는다.
 */
export async function updatePassword(_prevState: UpdatePasswordState, formData: FormData): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  if (!password || password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "재설정 세션이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  return { success: true };
}
