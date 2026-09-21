-- Cleanstand — Phase 1 schema
-- Run this in the Supabase SQL editor for project kcixeytbukkwqryxwwva.
--
-- Model: one company per owning auth user for MVP (대표/관리자가 직접 견적을 만드는
-- 5~30명 규모 업체가 타깃). All company-scoped tables carry company_id and are
-- locked down via RLS to rows the authenticated user owns through companies.owner_id.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. companies
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  business_registration_number text,
  representative_name text,      -- 대표자명
  address text,                  -- 주소
  phone text,                    -- 연락처(전화번호)
  logo_url text,                 -- 로고 이미지 공개 URL (Storage company-logos 버킷)
  general_admin_rate numeric(5,2) not null default 9.00,  -- 일반관리비율 % (공공 상한 9%)
  profit_rate numeric(5,2) not null default 10.00,         -- 이윤율 % (공공 상한 10%)
  vat_rate numeric(5,2) not null default 10.00,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index companies_owner_id_idx on companies(owner_id);

-- 로고 이미지 버킷. PDF는 서버(Puppeteer)에서 인증 없이 이 URL을 그대로 fetch하므로
-- public이어야 한다. 업로드/수정/삭제는 로그인한 본인(auth.uid() = objects.owner)만.
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

create policy "company_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'company-logos');

create policy "company_logos_owner_insert"
  on storage.objects for insert
  with check (bucket_id = 'company-logos' and auth.uid() = owner);

create policy "company_logos_owner_update"
  on storage.objects for update
  using (bucket_id = 'company-logos' and auth.uid() = owner);

create policy "company_logos_owner_delete"
  on storage.objects for delete
  using (bucket_id = 'company-logos' and auth.uid() = owner);

-- ---------------------------------------------------------------------------
-- 2. employees — 직원별 실제원가
-- ---------------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  role text not null,                                       -- role_standard_rates.role_name과 매칭
  base_salary numeric(12,2) not null default 0,              -- 기본급 (월)
  annual_leave_allowance numeric(12,2) not null default 0,   -- 연차수당 (월할)
  retirement_provision numeric(12,2) not null default 0,     -- 퇴직관련비용 (월할)
  insurance_burden numeric(12,2) not null default 0,          -- 4대보험 회사부담 (월)
  other_company_cost numeric(12,2) not null default 0,        -- 기타 회사부담비용 (월)
  monthly_work_hours numeric(6,2) not null default 209,       -- 1인당 월 투입 가능시간
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_company_id_idx on employees(company_id);

-- ---------------------------------------------------------------------------
-- 3. role_standard_rates — 신규 계약 배치 인력 예측이 불가하므로 역할별 가중평균
--    표준원가로 환산해서 견적에 사용 (수동 오버라이드 가능)
-- ---------------------------------------------------------------------------
create table role_standard_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  role_name text not null,
  standard_hourly_rate numeric(10,2) not null,
  is_manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, role_name)
);

create index role_standard_rates_company_id_idx on role_standard_rates(company_id);

-- ---------------------------------------------------------------------------
-- 4. productivity_rates — 업계 기본값(company_id null) + 회사 커스텀(company_id 지정)
--    Phase 2에서 이 둘을 병합하는 CRUD 화면이 붙는다. Phase 1은 스키마 + 시드만.
-- ---------------------------------------------------------------------------
create table productivity_rates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,  -- null = 업계 기본값
  work_type text not null,                                      -- 'office_general','hospital','factory','school','restroom','floor','glass','other'
  sqm_per_hour numeric(8,2) not null,
  display_name text,  -- 회사가 추가한 커스텀 작업유형의 표시용 이름(업계 기본값 8종은 비워둠 — 라벨은 코드에 하드코딩)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- plain composite unique (not partial): Postgres treats each null company_id as
  -- distinct, so global rows (company_id is null) never collide with each other at
  -- the DB level — fine, since only seed.sql writes those, never app code. A plain
  -- constraint (rather than a partial index) is required for Supabase upsert()'s
  -- ON CONFLICT column-name inference to work for company-override upserts.
  unique (company_id, work_type)
);

create index productivity_rates_company_id_idx on productivity_rates(company_id);

-- ---------------------------------------------------------------------------
-- 5. expense_items — 현장경비 (청소용품/장비/피복/운반/기타)
-- ---------------------------------------------------------------------------
create table expense_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category text not null check (category in ('supplies','equipment','uniform','transport','other')),
  name text not null,
  unit_cost numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expense_items_company_id_idx on expense_items(company_id);

-- ---------------------------------------------------------------------------
-- 6. regulation_versions — 공공입찰 모드 법정기준값, 반기별 버전 관리
--    (기준 개정 시 코드는 안 건드리고 값만 추가)
-- ---------------------------------------------------------------------------
create table regulation_versions (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null,
  label text not null,                                        -- '2026년 하반기'
  general_admin_rate_cap numeric(5,2) not null,                -- 9.00
  profit_rate_cap numeric(5,2) not null,                       -- 10.00
  simple_labor_daily_wage numeric(12,2) not null,              -- 127. 단순노무종사원 일급
  foreman_daily_wage numeric(12,2) not null,                   -- 129. 작업반장 일급
  national_pension_company_rate numeric(6,4) not null,         -- 국민연금 회사분 %
  health_insurance_company_rate numeric(6,4) not null,         -- 건강보험 회사분 %
  long_term_care_company_rate numeric(6,4) not null,           -- 장기요양 회사분 %
  employment_insurance_company_rate numeric(6,4) not null,     -- 고용보험 회사분 % (150인 미만 기준)
  industrial_accident_rate numeric(6,4) not null,              -- 산재보험 %
  source_note text,
  created_at timestamptz not null default now(),
  unique (effective_date)
);

-- ---------------------------------------------------------------------------
-- 7. quotes — 견적. site_conditions는 아직 확정 못한 현장 맥락 변수를 유연하게
--    담는 JSONB. 계산/집계에 실제 쓰이는 값은 전부 정식 컬럼으로 둔다.
-- ---------------------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  mode text not null check (mode in ('private', 'public')),
  regulation_version_id uuid references regulation_versions(id),  -- public 모드에서만 사용
  status text not null default 'draft' check (status in ('draft', 'sent', 'won', 'lost')),
  building_type text,          -- 오피스/병원/공장/학교/상가/기타 (과거견적 필터용)
  building_name text,
  area_sqm numeric(10,2),
  frequency_per_week integer,
  site_conditions jsonb not null default '{}'::jsonb,

  -- 예상치
  estimated_hours numeric(10,2),
  estimated_workers numeric(6,2),
  labor_cost numeric(14,2),
  legal_cost numeric(14,2),      -- 법정비용(4대보험 등) — 공공모드 "경비 中 보험료" 대응
  expense_cost numeric(14,2),
  admin_cost numeric(14,2),
  profit_amount numeric(14,2),
  supply_amount numeric(14,2),   -- 공급가액
  vat_amount numeric(14,2),
  quote_amount numeric(14,2),    -- 최종 견적

  -- 실측치 (장기 확장: 예상 vs 실제 비교용, MVP에서는 비워둠)
  actual_hours numeric(10,2),
  actual_workers numeric(6,2),
  actual_labor_cost numeric(14,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_company_id_idx on quotes(company_id);
create index quotes_building_type_idx on quotes(building_type);

-- ---------------------------------------------------------------------------
-- 8. quote_line_items — 견적서/산출내역서 PDF용 상세 항목
-- ---------------------------------------------------------------------------
create table quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  category text not null check (category in ('labor', 'expense', 'admin', 'profit', 'vat', 'other')),
  label text not null,
  amount numeric(14,2) not null,
  sort_order integer not null default 0,
  role_name text,          -- category='labor'인 행에서만 채워짐 (역할별 소계 — 산출내역서 PDF용)
  worker_count numeric(6,2), -- category='labor'인 행에서만 채워짐
  created_at timestamptz not null default now()
);

create index quote_line_items_quote_id_idx on quote_line_items(quote_id);

-- ---------------------------------------------------------------------------
-- 9. activity_log — 대시보드 "최근 활동" 피드용
-- ---------------------------------------------------------------------------
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in (
    'quote_sent', 'quote_status_changed', 'employee_added', 'employee_updated',
    'employee_removed', 'expense_item_added', 'company_updated'
  )),
  description text not null,
  target_id uuid,          -- 관련 견적/직원/경비항목 id (있으면)
  created_at timestamptz not null default now()
);

create index activity_log_company_created_idx on activity_log(company_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table companies enable row level security;
alter table employees enable row level security;
alter table role_standard_rates enable row level security;
alter table productivity_rates enable row level security;
alter table expense_items enable row level security;
alter table regulation_versions enable row level security;
alter table quotes enable row level security;
alter table quote_line_items enable row level security;
alter table activity_log enable row level security;

-- helper: does the current user own this company?
create or replace function auth_owns_company(target_company_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from companies
    where id = target_company_id
      and owner_id = auth.uid()
  );
$$;

-- companies: owner-only, full CRUD
create policy "companies_select_own" on companies
  for select using (owner_id = auth.uid());
create policy "companies_insert_own" on companies
  for insert with check (owner_id = auth.uid());
create policy "companies_update_own" on companies
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "companies_delete_own" on companies
  for delete using (owner_id = auth.uid());

-- employees / role_standard_rates / expense_items / quotes: scoped via company_id
create policy "employees_all_own" on employees
  for all using (auth_owns_company(company_id)) with check (auth_owns_company(company_id));

create policy "role_standard_rates_all_own" on role_standard_rates
  for all using (auth_owns_company(company_id)) with check (auth_owns_company(company_id));

create policy "expense_items_all_own" on expense_items
  for all using (auth_owns_company(company_id)) with check (auth_owns_company(company_id));

create policy "quotes_all_own" on quotes
  for all using (auth_owns_company(company_id)) with check (auth_owns_company(company_id));

-- productivity_rates: global rows (company_id is null) are readable by any
-- authenticated user; company rows are owner-only. Global rows are seeded by
-- migration (bypasses RLS) and are not writable by app users.
create policy "productivity_rates_select" on productivity_rates
  for select using (company_id is null or auth_owns_company(company_id));
create policy "productivity_rates_insert_own" on productivity_rates
  for insert with check (company_id is not null and auth_owns_company(company_id));
create policy "productivity_rates_update_own" on productivity_rates
  for update using (company_id is not null and auth_owns_company(company_id))
  with check (company_id is not null and auth_owns_company(company_id));
create policy "productivity_rates_delete_own" on productivity_rates
  for delete using (company_id is not null and auth_owns_company(company_id));

-- regulation_versions: read-only reference data for any authenticated user.
create policy "regulation_versions_select" on regulation_versions
  for select using (auth.role() = 'authenticated');

-- quote_line_items: scoped via parent quote's company
create policy "quote_line_items_all_own" on quote_line_items
  for all using (
    exists (select 1 from quotes where quotes.id = quote_id and auth_owns_company(quotes.company_id))
  )
  with check (
    exists (select 1 from quotes where quotes.id = quote_id and auth_owns_company(quotes.company_id))
  );

-- activity_log: scoped via company_id, same owner-only pattern as employees/quotes
create policy "activity_log_all_own" on activity_log
  for all using (auth_owns_company(company_id)) with check (auth_owns_company(company_id));
