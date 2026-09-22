/**
 * 업무유형별 아이콘 — 이 화면엔 디자인 캔버스가 없어서 그대로 옮겨올 원본이 없다.
 * 사이드바 아이콘(AppSidebar.tsx)과 같은 스타일(24x24, stroke 1.75, round cap/join)로
 * 새로 그렸다 — 참고 스크린샷의 아이콘을 픽셀 단위로 복제한 건 아니고, 같은 톤을 맞춘
 * 근사치다. 업계 기본값 8종은 의미가 뚜렷해 고유 아이콘을 줬고, 회사가 직접 추가한
 * 커스텀 항목은 이름이 임의 텍스트라 아이콘을 유추할 수 없어 태그 아이콘 하나로 통일했다.
 */
const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const KNOWN_ICONS: Record<string, React.ReactNode> = {
  office_general: (
    <svg {...ICON_PROPS}>
      <rect x="4" y="2" width="16" height="20" rx="1" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h2M14 6h2M8 10h2M14 10h2M8 14h2M14 14h2" />
    </svg>
  ),
  hospital: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  factory: (
    <svg {...ICON_PROPS}>
      <path d="M3 21V10l5 3V10l5 3V8l5 3v10z" />
      <path d="M3 21h18" />
    </svg>
  ),
  school: (
    <svg {...ICON_PROPS}>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1 2.5 3 6 3s6-2 6-3v-5" />
    </svg>
  ),
  restroom: (
    <svg {...ICON_PROPS}>
      <path d="M12 2s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12Z" />
    </svg>
  ),
  floor: (
    <svg {...ICON_PROPS}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  glass: (
    <svg {...ICON_PROPS}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M12 3v18M3 12h18" />
    </svg>
  ),
  other: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  ),
};

const CUSTOM_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M12 2 2 12l9 9 10-10V2z" />
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export function WorkTypeIcon({ workType }: { workType: string }) {
  return <>{KNOWN_ICONS[workType] ?? CUSTOM_ICON}</>;
}
