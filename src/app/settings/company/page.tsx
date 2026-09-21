import { getCurrentCompany } from "@/lib/company";
import { CompanyForm } from "./CompanyForm";

export default async function CompanySettingsPage() {
  const company = await getCurrentCompany();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">회사 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          {company ? "회사 정보와 관리비율·이윤율·VAT율을 수정합니다." : "먼저 회사 정보를 등록해주세요."}
        </p>
      </div>
      <CompanyForm company={company} />
    </main>
  );
}
