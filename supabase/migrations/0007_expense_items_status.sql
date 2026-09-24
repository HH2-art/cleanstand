-- ---------------------------------------------------------------------------
-- 0007: expense_items에 사용여부/비고 추가.
-- is_active=false인 항목은 새 견적 만들기 화면의 선택 목록에서 제외된다
-- (관리 목록에는 계속 보여서 다시 켤 수 있다). "적용방식"(월고정비/인원당/현장당/
-- 고정비) 컬럼은 계산 로직이 없어 이번에 추가하지 않는다.
-- ---------------------------------------------------------------------------

alter table expense_items
  add column if not exists is_active boolean not null default true,
  add column if not exists note text;

comment on column expense_items.is_active is '사용여부 — false면 새 견적 만들기 화면의 선택 목록에서 제외';
comment on column expense_items.note is '비고';
