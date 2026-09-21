alter table productivity_rates add column if not exists display_name text;

comment on column productivity_rates.display_name is
  '회사가 직접 추가한 커스텀 작업유형의 표시용 이름. 업계 기본값 8종(work_type이 ' ||
  'office_general/hospital/factory/school/restroom/floor/glass/other)은 비워두고 ' ||
  '코드의 하드코딩된 한글 라벨(src/lib/workTypeLabels.ts)을 그대로 쓴다.';
