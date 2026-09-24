import type { CSSProperties } from "react";

/**
 * 회사 아바타 — logo_url이 있으면 원형 이미지, 없으면 연한 브랜드블루 그라데이션
 * 배경 + 사람 실루엣 아이콘. 서버 컴포넌트(AppSidebar)와 클라이언트 컴포넌트
 * (홈페이지 HomeNav) 양쪽에서 쓰기 때문에 훅 없는 순수 프레젠테이셔널 컴포넌트로
 * 둔다(어느 쪽에 import해도 안전). 크기는 .company-avatar 기본 CSS(AppSidebar.css,
 * .cs-app-shell 스코프라 홈페이지에도 이미 적용됨)에 --avatar-size로 넘긴다.
 */
export function CompanyAvatar({
  name,
  logoUrl,
  size = 32,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`company-avatar ${className}`}
      style={{ "--avatar-size": `${size}px` } as CSSProperties}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} />
      ) : (
        <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </span>
  );
}
