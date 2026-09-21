-- Cleanstand — Phase 2 schema fixes
-- Run this in the Supabase SQL editor AFTER schema.sql + seed.sql (Phase 1).
--
-- Phase 1's schema.sql had two conflict-target bugs that only matter once you
-- start upserting: companies.owner_id and productivity_rates(company_id, work_type)
-- need PLAIN unique constraints for Supabase's upsert() to infer ON CONFLICT
-- correctly. Partial unique indexes aren't matched by column-name inference.

-- 1 company per owner — required for the 회사설정 CRUD upsert.
alter table companies add constraint companies_owner_id_key unique (owner_id);

-- Replace productivity_rates' two partial unique indexes with one plain composite
-- unique constraint — required for the 생산성기준 CRUD's company-override upsert.
-- Postgres still treats each null company_id as distinct, so global rows don't
-- collide with each other; that's fine since only seed.sql ever writes those.
drop index if exists productivity_rates_global_work_type_idx;
drop index if exists productivity_rates_company_work_type_idx;
alter table productivity_rates
  add constraint productivity_rates_company_work_type_key unique (company_id, work_type);
