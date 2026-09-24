import "@/styles/app-shell.css";
import "./dashboard.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { DashboardContent, type DashboardActivityRow, type DashboardQuoteRow } from "./DashboardContent";

function formatQuoteDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function monthKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function DashboardPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const [{ data: quoteRows }, { data: activityRows }] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, building_name, building_type, area_sqm, mode, status, quote_amount, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    // activity_log이 아직 없는 환경(마이그레이션 0005 미실행)에서도 에러 없이 빈 목록으로
    // 넘어가도록 결과를 그대로 ?? []에 맡긴다.
    supabase
      .from("activity_log")
      .select("description, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const quotes: DashboardQuoteRow[] = (quoteRows ?? []).map((q) => ({
    id: q.id,
    name: q.building_name ?? "이름 없는 현장",
    buildingType: q.building_type ?? "기타",
    area: q.area_sqm != null ? Number(q.area_sqm) : null,
    mode: q.mode as "private" | "public",
    status: q.status as "draft" | "sent" | "won" | "lost",
    amount: Number(q.quote_amount),
    date: formatQuoteDate(q.created_at),
    monthKey: monthKeyOf(q.created_at),
  }));

  const activity: DashboardActivityRow[] = (activityRows ?? []).map((a) => ({
    description: a.description,
    time: formatActivityTime(a.created_at),
  }));

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="dashboard" companyName={company.name} logoUrl={company.logo_url} />
      <div className="main">
        <div className="main-inner dashboard-page">
          <DashboardContent
            quotes={quotes}
            activity={activity}
            currentMonthKey={currentMonthKey}
            prevMonthKey={prevMonthKey}
          />
        </div>
      </div>
    </div>
  );
}
