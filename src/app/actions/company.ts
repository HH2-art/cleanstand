"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";
import { upsertCompanyRow } from "@/lib/company";

export type CompanyActionState = { error: string } | { success: true } | null;

function parseRate(raw: FormDataEntryValue | null, fieldLabel: string): number | { error: string } {
  const value = Number(raw);
  if (raw === null || raw === "" || Number.isNaN(value)) {
    return { error: `${fieldLabel}은(는) 숫자로 입력해주세요.` };
  }
  if (value < 0 || value > 100) {
    return { error: `${fieldLabel}은(는) 0~100 사이여야 합니다.` };
  }
  return value;
}

/**
 * 비밀번호 변경 필드가 비어있으면 null(변경 안 함). 둘 다 있으면 형식 검증 후 새 비밀번호를
 * 반환한다. 실제 supabase.auth.updateUser() 호출은 이미 세션 쿠키를 쥔 서버 클라이언트로
 * 하므로(signIn/signOut과 동일한 createClient()), 재인증 플로우가 따로 필요 없다.
 */
function validatePasswordChange(formData: FormData): { newPassword: string } | { error: string } | null {
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  if (!newPassword && !confirmPassword) return null;
  if (newPassword.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (newPassword !== confirmPassword) return { error: "비밀번호가 일치하지 않습니다." };
  return { newPassword };
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB
const LOGO_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * 로고 파일이 있으면 company-logos 버킷에 업로드하고 공개 URL을 반환한다.
 * 파일을 새로 안 골랐으면(재업로드 안 함) 폼의 existing_logo_url(기존 값)을 그대로 쓴다 —
 * 그래야 다른 필드만 수정할 때 로고가 사라지지 않는다.
 */
async function resolveLogoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData,
): Promise<string | null | { error: string }> {
  const file = formData.get("logo");
  const existingLogoUrl = String(formData.get("existing_logo_url") ?? "").trim() || null;

  if (!(file instanceof File) || file.size === 0) {
    return existingLogoUrl;
  }

  if (file.size > MAX_LOGO_BYTES) {
    return { error: "로고 이미지는 5MB 이하여야 합니다." };
  }
  const ext = LOGO_MIME_EXT[file.type];
  if (!ext) {
    return { error: "로고 이미지는 PNG, JPG, WEBP, SVG 형식만 가능합니다." };
  }

  const path = `${userId}/logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("company-logos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { error: `로고 업로드에 실패했습니다: ${uploadError.message}` };

  const { data: publicUrlData } = supabase.storage.from("company-logos").getPublicUrl(path);
  return publicUrlData.publicUrl;
}

export async function upsertCompany(
  _prevState: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "회사명을 입력해주세요." };

  const generalAdminRate = parseRate(formData.get("general_admin_rate"), "일반관리비율");
  if (typeof generalAdminRate !== "number") return generalAdminRate;

  const profitRate = parseRate(formData.get("profit_rate"), "이윤율");
  if (typeof profitRate !== "number") return profitRate;

  const vatRate = parseRate(formData.get("vat_rate"), "VAT율");
  if (typeof vatRate !== "number") return vatRate;

  const passwordChange = validatePasswordChange(formData);
  if (passwordChange && "error" in passwordChange) return passwordChange;

  const businessRegistrationNumber = String(formData.get("business_registration_number") ?? "").trim() || null;
  const representativeName = String(formData.get("representative_name") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const logoUrl = await resolveLogoUrl(supabase, user.id, formData);
  if (logoUrl !== null && typeof logoUrl === "object") return logoUrl;

  const result = await upsertCompanyRow(supabase, {
    ownerId: user.id,
    name,
    businessRegistrationNumber,
    representativeName,
    address,
    phone,
    logoUrl,
    generalAdminRate,
    profitRate,
    vatRate,
  });
  if ("error" in result) return result;

  await logActivity(supabase, result.id, user.id, "company_updated", `"${name}" 회사 설정을 수정했습니다.`);

  if (passwordChange) {
    const { error: passwordError } = await supabase.auth.updateUser({ password: passwordChange.newPassword });
    if (passwordError) return { error: `비밀번호 변경에 실패했습니다: ${passwordError.message}` };
  }

  revalidatePath("/settings/company");
  return { success: true };
}
