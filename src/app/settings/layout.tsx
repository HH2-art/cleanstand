import Link from "next/link";

const LINKS = [
  { href: "/settings/company", label: "회사 설정" },
  { href: "/settings/employees", label: "직원 관리" },
  { href: "/settings/productivity", label: "생산성 기준" },
  { href: "/settings/expenses", label: "경비 항목" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <nav className="flex gap-4 border-b border-gray-200 px-4 py-3 text-sm">
        <Link href="/dashboard" className="text-gray-400 underline">
          ← 대시보드
        </Link>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="underline">
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
