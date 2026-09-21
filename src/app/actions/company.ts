"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activityLog";

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

  const businessRegistrationNumber = String(formData.get("business_registration_number") ?? "").trim() || null;
  const representativeName = String(formData.get("representative_name") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  const logoUrl = await resolveLogoUrl(supabase, user.id, formData);
  if (logoUrl !== null && typeof logoUrl === "object") return logoUrl;

  const { data: companyRow, error } = await supabase
    .from("companies")
    .upsert(
      {
        owner_id: user.id,
        name,
        business_registration_number: businessRegistrationNumber,
        representative_name: representativeName,
        address,
        phone,
        logo_url: logoUrl,
        general_admin_rate: generalAdminRate,
        profit_rate: profitRate,
        vat_rate: vatRate,
      },
      { onConflict: "owner_id" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (companyRow) {
    await logActivity(supabase, companyRow.id, user.id, "company_updated", `"${name}" 회사 설정을 수정했습니다.`);
  }

  revalidatePath("/settings/company");
  return { success: true };
}
