import Link from "next/link";
import { createEmployee } from "@/app/actions/employees";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { DeleteEmployeeButton } from "./DeleteEmployeeButton";
import { EmployeeForm } from "./EmployeeForm";
import { RoleRatesPanel } from "./RoleRatesPanel";

export default async function EmployeesPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const [{ data: employees }, { data: roleRates }] = await Promise.all([
    supabase.from("employees").select("*").eq("company_id", company.id).order("created_at"),
    supabase
      .from("role_standard_rates")
      .select("role_name, standard_hourly_rate, is_manual_override")
      .eq("company_id", company.id)
      .order("role_name"),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">직원 관리</h1>
        <p className="mt-1 text-sm text-gray-500">{company.name}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">역할별 표준원가</h2>
        <RoleRatesPanel rates={roleRates ?? []} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">직원 목록</h2>
        {employees && employees.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">이름</th>
                <th className="py-2">역할</th>
                <th className="py-2">월 투입시간</th>
                <th className="py-2">재직</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b">
                  <td className="py-2">{emp.name}</td>
                  <td className="py-2">{emp.role}</td>
                  <td className="py-2">{emp.monthly_work_hours}h</td>
                  <td className="py-2">{emp.active ? "재직중" : "퇴사"}</td>
                  <td className="py-2 text-right">
                    <Link href={`/settings/employees/${emp.id}`} className="text-xs underline">
                      수정
                    </Link>
                    <DeleteEmployeeButton id={emp.id} name={emp.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">등록된 직원이 없습니다.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">새 직원 추가</h2>
        <EmployeeForm action={createEmployee} submitLabel="추가" />
      </section>
    </main>
  );
}
