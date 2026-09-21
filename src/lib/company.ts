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
