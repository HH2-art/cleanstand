import Link from "next/link";
import { createExpenseItem, deleteExpenseItem, type ExpenseCategory } from "@/app/actions/expenses";
import { requireCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";
import { ExpenseForm } from "./ExpenseForm";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./labels";

export default async function ExpensesPage() {
  const company = await requireCurrentCompany();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("expense_items")
    .select("*")
    .eq("company_id", company.id)
    .order("category")
    .order("name");

  const byCategory = new Map<ExpenseCategory, typeof items>();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const item of items ?? []) {
    byCategory.get(item.category as ExpenseCategory)?.push(item);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold">경비 항목</h1>
        <p className="mt-1 text-sm text-gray-500">{company.name}</p>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const categoryItems = byCategory.get(cat) ?? [];
        return (
          <section key={cat} className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{CATEGORY_LABELS[cat]}</h2>
            {categoryItems.length > 0 ? (
              <table className="w-full text-sm">
                <tbody>
                  {categoryItems.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-right">{item.unit_cost.toLocaleString()}원</td>
                      <td className="py-2 pl-4 text-right">
                        <Link href={`/settings/expenses/${item.id}`} className="text-xs underline">
                          수정
                        </Link>
                        <form action={deleteExpenseItem} className="inline">
                          <input type="hidden" name="id" value={item.id} />
                          <button type="submit" className="ml-3 text-xs text-red-600 underline">
                            삭제
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-400">등록된 항목이 없습니다.</p>
            )}
          </section>
        );
      })}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">새 경비 항목 추가</h2>
        <ExpenseForm action={createExpenseItem} submitLabel="추가" />
      </section>
    </main>
  );
}
