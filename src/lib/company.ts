import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  business_registration_number: string | null;
  representative_name: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  general_admin_rate: number;
  profit_rate: number;
  vat_rate: number;
}

/** 현재 로그인한 유저가 소유한 회사를 반환한다. 아직 없으면 null. */
export async function getCurrentCompany(): Promise<Company | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("companies").select("*").eq("owner_id", user.id).maybeSingle();
  return data;
}

/** 회사가 없으면 회사 설정 화면으로 보낸다 — 회사가 반드시 있어야 하는 화면(직원관리 등)에서 사용. */
export async function requireCurrentCompany(): Promise<Company> {
  const company = await getCurrentCompany();
  if (!company) {
    redirect("/settings/company");
  }
  return company;
}

export interface UpsertCompanyInput {
  ownerId: string;
  name: string;
  businessRegistrationNumber?: string | null;
  representativeName?: string | null;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  generalAdminRate?: number;
  profitRate?: number;
  vatRate?: number;
}

/**
 * companies row을 owner_id 기준으로 upsert한다 — 회사 설정 화면(upsertCompany 액션)과
 * 회원가입 직후 자동 회사 생성이 공유하는 핵심 로직(중복 구현 방지). 요율 3종을
 * 생략하면 기본값(9/10/10, 회원가입 시 쓰는 값)을 쓴다.
 *
 * 호출자가 이미 인증된 세션을 쥔 supabase 서버 클라이언트를 넘겨야 한다 — RLS 정책
 * companies_insert_own이 owner_id = auth.uid()를 요구하기 때문에, 세션 없는(익명)
 * 클라이언트로는 절대 성공하지 않는다(서비스 롤 키는 이 프로젝트에 없음).
 */
export async function upsertCompanyRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: UpsertCompanyInput,
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("companies")
    .upsert(
      {
        owner_id: input.ownerId,
        name: input.name,
        business_registration_number: input.businessRegistrationNumber ?? null,
        representative_name: input.representativeName ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        logo_url: input.logoUrl ?? null,
        general_admin_rate: input.generalAdminRate ?? 9,
        profit_rate: input.profitRate ?? 10,
        vat_rate: input.vatRate ?? 10,
      },
      { onConflict: "owner_id" },
    )
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}
