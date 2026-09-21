/**
 * productivity_rates의 업계 기본값 8종(work_type)에 대한 한글 라벨. 이 8개는
 * display_name이 비어있는 게 정상이라 여기 하드코딩된 라벨을 쓴다 — 회사가 새로
 * 추가한 커스텀 작업유형은 display_name을 쓴다(workTypeLabel 참고).
 */
export const KNOWN_WORK_TYPE_LABELS: Record<string, string> = {
  office_general: "오피스 일반청소",
  hospital: "병원",
  factory: "공장",
  school: "학교",
  restroom: "화장실",
  floor: "바닥",
  glass: "유리",
  other: "기타",
};

export const KNOWN_WORK_TYPES = Object.keys(KNOWN_WORK_TYPE_LABELS);

export function workTypeLabel(workType: string, displayName?: string | null): string {
  return KNOWN_WORK_TYPE_LABELS[workType] ?? displayName ?? workType;
}
