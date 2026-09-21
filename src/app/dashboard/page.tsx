import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { getCurrentCompany } from "@/lib/company";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABELS: Record<string, string> = {
  draft: "임시저장",
  sent: "발송완료",
  won: "수주성공",
  lost: "수주실패",
};

const BUILDING_TYPES = ["오피스", "병원", "공장", "학교", "상가", "기타"];

function won(amount: number) {
  return `${Math.round(amount).toLocaleString()}원`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; building_type?: string }>;
}) {
  const { status, building_type: buildingType } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const company = await getCurrentCompany();

  let quotes: Array<{
    id: string;
    building_name: string;
    building_type: string | null;
    mode: string;
    status: string;
    quote_amount: number;
    created_at: string;
  }> = [];

  if (company) {
    let query = supabase
      .from("quotes")
      .select("id, building_name, building_type, mode, status, quote_amount, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (buildingType) query = query.eq("building_type", buildingType);

    const { data } = await query;
    quotes = data ?? [];
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">견적 목록</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-gray-500 underline">
            로그아웃
          </button>
        </form>
      </div>
      <p className="text-sm text-gray-500">{user.email}</p>

      <div className="flex flex-wrap gap-2 text-sm underline">
        <Link href="/settings/company">회사 설정</Link>
        <Link href="/settings/employees">직원 관리</Link>
        <Link href="/settings/productivity">생산성 기준</Link>
        <Link href="/settings/expenses">경비 항목</Link>
      </div>

      {!company ? (
        <p className="text-sm text-gray-400">
          견적을 만들려면 먼저{" "}
          <Link href="/settings/company" className="underline">
            회사 설정
          </Link>
          을 완료해주세요.
        </p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3 text-sm" action="/dashboard">
            <div className="flex flex-col gap-1">
              <label htmlFor="status" className="font-medium">
                상태
              </label>
              <select id="status" name="status" defaultValue={status ?? ""} className="rounded-md border border-gray-300 px-2 py-1">
                <option value="">전체</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="building_type" className="font-medium">
                건물유형
              </label>
              <select
                id="building_type"
                name="building_type"
                defaultValue={buildingType ?? ""}
                className="rounded-md border border-gray-300 px-2 py-1"
              >
                <option value="">전체</option>
                {BUILDING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-md border border-gray-300 px-3 py-1.5">
              필터 적용
            </button>
            {(status || buildingType) && (
              <Link href="/dashboard" className="text-gray-400 underline">
                초기화
              </Link>
            )}
          </form>

          {quotes.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2">현장명</th>
                  <th className="py-2">건물유형</th>
                  <th className="py-2">모드</th>
                  <th className="py-2">상태</th>
                  <th className="py-2 text-right">견적금액</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b">
                    <td className="py-2">
                      <Link href={`/quotes/${quote.id}`} className="underline">
                        {quote.building_name}
                      </Link>
                    </td>
                    <td className="py-2">{quote.building_type ?? "-"}</td>
                    <td className="py-2">{quote.mode === "private" ? "일반" : "공공입찰"}</td>
                    <td className="py-2">{STATUS_LABELS[quote.status] ?? quote.status}</td>
                    <td className="py-2 text-right">{won(quote.quote_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">
              {status || buildingType ? "조건에 맞는 견적이 없습니다." : "아직 견적이 없습니다."}
            </p>
          )}

          <Link
            href="/quotes/new"
            className="w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
          >
            새 견적 만들기
          </Link>
        </>
      )}
    </main>
  );
}
