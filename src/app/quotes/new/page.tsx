import "@/styles/app-shell.css";
import "./new-quote.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { requireCurrentCompany } from "@/lib/company";
import { mergeProductivityRates } from "@/lib/productivityMerge";
import { createClient } from "@/lib/supabase/server";
import { NewQuoteForm } from "./NewQuoteForm";

export default async function NewQuotePage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const [{ data: roleRates }, { data: globalRates }, { data: companyRates }, { data: expenseItems }, { data: regulationRow }] =
    await Promise.all([
      supabase
        .from("role_standard_rates")
        .select("role_name, standard_hourly_rate")
        .eq("company_id", company.id)
        .order("role_name"),
      supabase.from("productivity_rates").select("work_type, sqm_per_hour, display_name").is("company_id", null),
      supabase.from("productivity_rates").select("work_type, sqm_per_hour, display_name").eq("company_id", company.id),
      supabase.from("expense_items").select("id, name, category, unit_cost").eq("company_id", company.id).order("category"),
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
      <AppSidebar current="new-quote" companyName={company.name} />
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
          />
        </div>
      </div>
    </div>
  );
}
