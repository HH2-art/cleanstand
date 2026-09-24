/**
 * 경비항목 구분(카테고리)별 아이콘 — 이 화면엔 디자인 캔버스가 없어서 그대로 옮겨올
 * 원본이 없다. 생산성기준 페이지의 WorkTypeIcon과 같은 스타일(24x24, stroke 1.75,
 * round cap/join)로 새로 그렸다.
 */
import type { ExpenseCategory } from "@/app/actions/expenses";

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

const ICONS: Record<ExpenseCategory, React.ReactNode> = {
  supplies: (
    <svg {...ICON_PROPS}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5M12 13v8" />
    </svg>
  ),
  equipment: (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6l-6.6 6.6a1.5 1.5 0 0 0 2.1 2.1l6.6-6.6a4 4 0 0 0 5.6-5.6l-2.1 2.1-2.5-.6-.6-2.5 2.1-2.1Z" />
    </svg>
  ),
  uniform: (
    <svg {...ICON_PROPS}>
      <path d="M8 3 4 6v3h3v11h10V9h3V6l-4-3-2 2h-2Z" />
    </svg>
  ),
  transport: (
    <svg {...ICON_PROPS}>
      <path d="M3 16V7a1 1 0 0 1 1-1h9v10" />
      <path d="M13 10h4l4 4v2h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
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

export function ExpenseCategoryIcon({ category }: { category: ExpenseCategory }) {
  return <>{ICONS[category]}</>;
}
