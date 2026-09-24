import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import "@/styles/app-shell.css";
import "./AppSidebar.css";

export type AppSidebarCurrent = "dashboard" | "new-quote" | "employees" | "productivity" | "expenses" | "company";

/**
 * 공통 사이드바 — CleanStand Dashboard 디자인 캔버스(Main.dc.html)의 사이드바를
 * 마크업/클래스/SVG까지 그대로 옮긴 컴포넌트. 대시보드 외 다른 화면도 이 컴포넌트를
 * 재사용한다. 캔버스는 외부에 게시된 정적 페이지라 절대경로+target="_blank"였지만,
 * 실제 앱에서는 당연히 내부 상대경로 Link로 바꿨다(유일한 의도적 차이).
 */
export function AppSidebar({
  current,
  companyName,
  logoUrl,
}: {
  current: AppSidebarCurrent;
  companyName: string;
  logoUrl?: string | null;
}) {
  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-company">
        <CompanyAvatar name={companyName} logoUrl={logoUrl} size={28} />
      </Link>

      {current === "dashboard" ? (
        <span className="nav-item current">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
          대시보드
        </span>
      ) : (
        <Link className="nav-item" href="/dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
          대시보드
        </Link>
      )}

      {current === "new-quote" ? (
        <span className="nav-cta current">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          새 견적 만들기
        </span>
      ) : (
        <Link className="nav-cta" href="/quotes/new">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          새 견적 만들기
        </Link>
      )}

      <div className="nav-divider" />

      {current === "employees" ? (
        <span className="nav-item current">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          직원관리
        </span>
      ) : (
        <Link className="nav-item" href="/settings/employees">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          직원관리
        </Link>
      )}

      {current === "productivity" ? (
        <span className="nav-item current">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0-8-8" /><path d="M12 12 9 9M12 4v2M4 12h2M20 12h-2" /></svg>
          생산성기준
        </span>
      ) : (
        <Link className="nav-item" href="/settings/productivity">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20a8 8 0 1 0-8-8" /><path d="M12 12 9 9M12 4v2M4 12h2M20 12h-2" /></svg>
          생산성기준
        </Link>
      )}

      {current === "expenses" ? (
        <span className="nav-item current">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13l3 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" /><path d="M8 10h8M8 14h5" /></svg>
          경비항목
        </span>
      ) : (
        <Link className="nav-item" href="/settings/expenses">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13l3 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" /><path d="M8 10h8M8 14h5" /></svg>
          경비항목
        </Link>
      )}

      {current === "company" ? (
        <span className="nav-item current">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          회사설정
        </span>
      ) : (
        <Link className="nav-item" href="/settings/company">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          회사설정
        </Link>
      )}

      <div className="nav-divider" />

      <div className="sidebar-bottom">
        <form action={signOut}>
          <button type="submit" className="nav-logout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
