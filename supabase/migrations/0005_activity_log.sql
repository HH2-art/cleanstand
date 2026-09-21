create table activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in (
    'quote_sent', 'quote_status_changed', 'employee_added', 'employee_updated',
    'employee_removed', 'expense_item_added', 'company_updated'
  )),
  description text not null,
  target_id uuid,
  created_at timestamptz not null default now()
);

create index activity_log_company_created_idx on activity_log(company_id, created_at desc);

alter table activity_log enable row level security;

create policy "activity_log_all_own" on activity_log
  for all using (auth_owns_company(company_id)) with check (auth_owns_company(company_id));
