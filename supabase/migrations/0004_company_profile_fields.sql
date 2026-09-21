-- ---------------------------------------------------------------------------
-- 0004: companies 테이블에 회사 프로필 필드 추가 (대표자명/주소/연락처/로고)
-- + 로고 이미지용 Storage 버킷과 RLS 정책.
-- ---------------------------------------------------------------------------

alter table companies
  add column if not exists representative_name text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists logo_url text;

comment on column companies.representative_name is '대표자명';
comment on column companies.address is '주소';
comment on column companies.phone is '연락처(전화번호)';
comment on column companies.logo_url is '로고 이미지 공개 URL (Supabase Storage company-logos 버킷)';

-- ---------------------------------------------------------------------------
-- Storage: company-logos 버킷.
-- 견적서/산출내역서 PDF는 서버(Puppeteer)에서 렌더링되며 이 URL을 인증 없이
-- 그대로 fetch하므로 public 버킷이어야 한다. 업로드/수정/삭제는 로그인한 본인
-- (auth.uid() = storage.objects.owner)만 가능하도록 제한한다.
-- ---------------------------------------------------------------------------
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
