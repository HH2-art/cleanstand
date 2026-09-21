import "server-only";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import type { PdfQuoteData } from "./types";

export async function loadQuoteData(quoteId: string): Promise<PdfQuoteData | null> {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, regulation_versions(label)")
    .eq("id", quoteId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!quote) return null;

  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select("category, label, amount, role_name, worker_count")
    .eq("quote_id", quoteId)
    .order("sort_order");

  return {
    company: {
      name: company.name,
      businessRegistrationNumber: company.business_registration_number,
      representativeName: company.representative_name,
      address: company.address,
      phone: company.phone,
      logoUrl: company.logo_url,
    },
    quote: {
      buildingName: quote.building_name,
      buildingType: quote.building_type,
      areaSqm: Number(quote.area_sqm),
      frequencyPerWeek: quote.frequency_per_week,
      mode: quote.mode,
      regulationLabel: quote.regulation_versions?.label ?? null,
      estimatedHours: Number(quote.estimated_hours),
      estimatedWorkers: Number(quote.estimated_workers),
      laborCost: Number(quote.labor_cost),
      legalCost: Number(quote.legal_cost),
      expenseCost: Number(quote.expense_cost),
      adminCost: Number(quote.admin_cost),
      profitAmount: Number(quote.profit_amount),
      supplyAmount: Number(quote.supply_amount),
      vatAmount: Number(quote.vat_amount),
      quoteAmount: Number(quote.quote_amount),
      createdAt: quote.created_at,
    },
    lineItems: (lineItems ?? []).map((item) => ({
      category: item.category,
      label: item.label,
      amount: Number(item.amount),
      roleName: item.role_name,
      workerCount: item.worker_count === null ? null : Number(item.worker_count),
    })),
  };
}
