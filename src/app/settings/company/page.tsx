import "@/styles/app-shell.css";
import "./company.css";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { getCurrentCompany } from "@/lib/company";
import { CompanyForm } from "./CompanyForm";

export default async function CompanySettingsPage() {
  const company = await getCurrentCompany();

  return (
    <div className="cs-app-shell shell">
      <AppSidebar current="company" companyName={company?.name ?? "회사 미등록"} />
      <div className="main">
        <CompanyForm company={company} />
      </div>
    </div>
  );
}
