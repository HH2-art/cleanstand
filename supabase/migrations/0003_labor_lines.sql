-- Cleanstand — 역할별 노무비 분리 (다중 역할 견적 지원)
-- Run this in the Supabase SQL editor after 0002_phase2_constraints.sql.
--
-- 계산엔진이 견적당 표준 시급원가 하나 대신 [역할, 인원수] 여러 개를 받아
-- 역할별로 (인원수 × 작업시간 × 시급) 소계를 내도록 바뀌었다. 새 테이블은
-- 필요 없다고 판단했다 — quote_line_items가 이미 "견적당 여러 항목"을
-- 저장하는 구조라 role_name/worker_count 두 컬럼만 추가하면 역할별 소계를
-- (라벨+금액뿐 아니라 원본 인원수까지) 그대로 담을 수 있다.

alter table quote_line_items add column if not exists role_name text;
alter table quote_line_items add column if not exists worker_count numeric(6,2);
