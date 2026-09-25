import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * 새 비밀번호 설정 화면 — 이메일의 재설정 링크를 눌러 /auth/callback
 * (exchangeCodeForSession, 무수정)을 거쳐야만 도달한다. 그 콜백이 인증된
 * recovery 세션을 세워주므로, 여기서는 그 세션이 실제로 있는지만 서버에서
 * 확인한다 — 없으면(링크 없이 직접 접근, 만료된 링크 등) 재요청 화면으로 보낸다.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/forgot-password");
  }

  return (
    <AuthShell>
      <ResetPasswordForm />
    </AuthShell>
  );
}
