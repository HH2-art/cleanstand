import { notFound } from "next/navigation";
import { updateEmployee } from "@/app/actions/employees";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { EmployeeForm } from "../EmployeeForm";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle();

  if (!employee) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-bold">직원 정보 수정</h1>
      <EmployeeForm action={updateEmployee} defaultValues={employee} submitLabel="저장" />
    </main>
  );
}
