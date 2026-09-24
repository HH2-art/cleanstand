import { notFound, redirect } from "next/navigation";
import "@/styles/app-shell.css";
import "../../new/new-quote.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { getQuoteForEdit } from "@/app/actions/quotes";
import { requireCurrentCompany } from "@/lib/company";
import { mergeProductivityRates } from "@/lib/productivityMerge";
import { createClient } from "@/lib/supabase/server";
import { NewQuoteForm } from "../../new/NewQuoteForm";

/**
 * 견적 수정 화면 — /quotes/new와 같은 폼(NewQuoteForm)을 기존 값으로 채워서 재사용한다.
 * "임시저장" 상태일 때만 수정 가능 — 발송완료 이후 상태는 여기 들어와도 상세 페이지로
 * 돌려보낸다(버튼 자체는 상세 페이지에서 이미 숨기지만, 직접 URL로 들어오는 경우까지
 * 막아야 진짜 안전하다). updateQuote 서버 액션도 같은 조건을 한 번 더 검사한다.
 */
export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const editData = await getQuoteForEdit(id);
  if (!editData) notFound();
  if (editData.status !== "draft") redirect(`/quotes/${id}`);

  const [{ data: roleRates }, { data: globalRates }, { data: companyRates }, { data: expenseItems }, { data: regulationRow }] =
    await Promise.all([
      supabase
        .from("role_standard_rates")
        .select("role_name, standard_hourly_rate")
        .eq("company_id", company.id)
        .order("role_name"),
      supabase.from("productivity_rates").select("work_type, sqm_per_hour, display_name").is("company_id", null),
      supabase.from("productivity_rates").select("work_type, sqm_per_hour, display_name").eq("company_id", company.id),
      supabase
        .from("expense_items")
        .select("id, name, category, unit_cost")
        .eq("company_id", company.id)
        .eq("is_active", true)
        .order("category"),
      supabase.from("regulation_versions").select("*").order("effective_date", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const productivityRates = mergeProductivityRates(globalRates ?? [], companyRates ?? []);

  const regulation = regulationRow
    ? {
        effectiveDate: regulationRow.effective_date as string,
        label: regulationRow.label as string,
        generalAdminRateCap: regulationRow.general_admin_rate_cap as number,
        profitRateCap: regulationRow.profit_rate_cap as number,
        simpleLaborDailyWage: regulationRow.simple_labor_daily_wage as number,
        foremanDailyWage: regulationRow.foreman_daily_wage as number,
        nationalPensionCompanyRate: regulationRow.national_pension_company_rate as number,
        healthInsuranceCompanyRate: regulationRow.health_insurance_company_rate as number,
        longTermCareCompanyRate: regulationRow.long_term_care_company_rate as number,
        employmentInsuranceCompanyRate: regulationRow.employment_insurance_company_rate as number,
        industrialAccidentRate: regulationRow.industrial_accident_rate as number,
      }
    : null;

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="new-quote" companyName={company.name} logoUrl={company.logo_url} />
      <div className="main">
        <div className="quotes-new-page">
          <NewQuoteForm
            company={{
              name: company.name,
              generalAdminRate: company.general_admin_rate,
              profitRate: company.profit_rate,
              vatRate: company.vat_rate,
            }}
            roleRates={roleRates ?? []}
            productivityRates={productivityRates}
            expenseItems={expenseItems ?? []}
            regulation={regulation}
            editing={editData}
          />
        </div>
      </div>
    </div>
  );
}
