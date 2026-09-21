-- Cleanstand — seed data
-- Run this after schema.sql in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- regulation_versions: 2026년 하반기 확정값 (2026.7.1~)
-- 출처:
--   - 일반관리비율 9% / 이윤율 10%: 국가/지방계약법 시행규칙 제8조
--   - 노무비(127. 단순노무종사원 95,767원 / 129. 작업반장 147,122원, 2026.7.1~):
--     중소기업중앙회 「2026년 상반기 중소제조업 직종별 임금조사 보고서」,
--     계약예규 「정부 입찰·계약 집행기준」 제76조의3
--   - 4대보험 회사부담분(2026년 확정, 상시근로자 150인 미만 기준):
--     국민연금 4.75% / 건강보험 3.595% / 장기요양 0.4724% /
--     고용보험 1.15%(실업급여 0.9% + 고용안정·직업능력개발 0.25%) /
--     산재보험 0.80%(시설관리 및 사업지원 서비스업, 고용노동부고시 제2025-91호)
-- ---------------------------------------------------------------------------
insert into regulation_versions (
  effective_date, label,
  general_admin_rate_cap, profit_rate_cap,
  simple_labor_daily_wage, foreman_daily_wage,
  national_pension_company_rate, health_insurance_company_rate,
  long_term_care_company_rate, employment_insurance_company_rate,
  industrial_accident_rate, source_note
) values (
  '2026-07-01', '2026년 하반기',
  9.00, 10.00,
  95767, 147122,
  4.75, 3.595,
  0.4724, 1.15,
  0.80,
  '국가계약법 시행규칙 2026.1.2 개정 / 지방계약법 시행규칙 2026.7.1 개정, 노무비는 중소기업중앙회 2026년 상반기 중소제조업 직종별 임금조사 보고서(통계청 지정통계 제340005호) 기준'
);

-- ---------------------------------------------------------------------------
-- productivity_rates: 업계 기본값 (company_id null).
-- 사업계획 문서 확인 사항: "㎡당 몇 분" 전국 공통 생산성 기준은 업계에 실제로
-- 존재하지 않음 (건설 표준품셈은 있으나 청소 전용은 없음) — 인터뷰로만 검증 가능한
-- 미해결 사항. office_general=100 만 문서에 나온 예시값이고, 나머지
-- (hospital/factory/school/restroom/floor/glass/other)는 자리채움용 러프 추정치이지
-- 조사된 수치가 아님. 인터뷰 결과가 나오면 반드시 교체할 것 — SaaS도 이 값을
-- 강제하지 않고 회사가 자유롭게 덮어쓸 수 있도록 설계됨(Phase 2 CRUD에서 병합).
-- ---------------------------------------------------------------------------
insert into productivity_rates (company_id, work_type, sqm_per_hour) values
  (null, 'office_general', 100),  -- 문서에 명시된 예시값
  (null, 'hospital', 70),         -- TODO: 인터뷰 전까지는 추정치
  (null, 'factory', 120),         -- TODO: 인터뷰 전까지는 추정치
  (null, 'school', 90),           -- TODO: 인터뷰 전까지는 추정치
  (null, 'restroom', 25),         -- TODO: 인터뷰 전까지는 추정치
  (null, 'floor', 150),           -- TODO: 인터뷰 전까지는 추정치
  (null, 'glass', 60),            -- TODO: 인터뷰 전까지는 추정치
  (null, 'other', 80);            -- TODO: 인터뷰 전까지는 추정치
