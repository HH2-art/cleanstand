import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">Cleanstand</h1>
      <p className="max-w-md text-sm text-gray-500">
        상업용 청소업체 견적 자동화 SaaS. 홈페이지 디자인은 Phase 2에서 채워집니다 — 지금은
        회원가입/로그인 플로우만 연결되어 있습니다.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
          시작하기
        </Link>
        <Link href="/login" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium">
          로그인
        </Link>
      </div>
    </main>
  );
}
