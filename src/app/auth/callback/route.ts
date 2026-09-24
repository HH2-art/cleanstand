import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertCompanyRow } from "@/lib/company";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // exchangeCodeForSession 직후엔 이 supabase 클라이언트가 진짜 인증된 세션을
      // 쥐고 있다 — signUp() 시점엔 세션이 없어서(이메일 인증 필요 흐름) 미뤄뒀던
      // 회사 생성(companies_insert_own RLS가 요구하는 인증된 owner_id)을 여기서
      // 처리한다. user_metadata.company_name은 signUp 액션이 실어 보낸 값
      // (src/app/actions/auth.ts 참고).
      //
      // 이미 회사가 있으면(인증 링크 재클릭, 비번 재설정 등으로 이 콜백이 또
      // 실행되는 경우) 절대 건드리지 않는다 — 먼저 존재 여부를 확인해서, 그 사이
      // 사용자가 /settings/company에서 직접 고친 회사명이 가입 당시 메타데이터
      // 값으로 덮어써지는 일이 없게 한다.
      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();
      if (getUserError) {
        console.error("[auth/callback] getUser failed after exchangeCodeForSession:", getUserError.message);
      } else if (user) {
        const companyName = typeof user.user_metadata?.company_name === "string" ? user.user_metadata.company_name.trim() : "";
        if (companyName) {
          const { data: existing, error: existingError } = await supabase
            .from("companies")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();
          if (existingError) {
            console.error(`[auth/callback] failed to check existing company for user ${user.id}:`, existingError.message);
          } else if (!existing) {
            // 여기서 실패해도 이전엔 결과를 그냥 버려서(에러가 조용히 사라짐) 회사가
            // 생성 안 된 채로 /dashboard로 넘어가고, requireCurrentCompany()가 다시
            // /settings/company로 돌려보내는 원인을 추적할 방법이 없었다 — 최소한
            // 서버 로그에는 남겨서 재발 시 바로 원인을 알 수 있게 한다.
            const result = await upsertCompanyRow(supabase, { ownerId: user.id, name: companyName });
            if ("error" in result) {
              console.error(`[auth/callback] upsertCompanyRow failed for user ${user.id} (company_name="${companyName}"):`, result.error);
            }
          }
        } else {
          console.error(`[auth/callback] user ${user.id} has no company_name in user_metadata — signUp action may not have set it.`);
        }
      }
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=인증에 실패했습니다. 다시 시도해주세요.`);
}
