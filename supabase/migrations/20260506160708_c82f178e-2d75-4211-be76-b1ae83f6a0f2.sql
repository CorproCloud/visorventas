
-- Storage bucket for raw uploaded files
insert into storage.buckets (id, name, public)
values ('datasets', 'datasets', true)
on conflict (id) do nothing;

-- Permissive storage policies (no auth in this app)
create policy "datasets_public_select"
  on storage.objects for select
  using (bucket_id = 'datasets');
create policy "datasets_public_insert"
  on storage.objects for insert
  with check (bucket_id = 'datasets');
create policy "datasets_public_update"
  on storage.objects for update
  using (bucket_id = 'datasets');
create policy "datasets_public_delete"
  on storage.objects for delete
  using (bucket_id = 'datasets');

-- Metadata table
create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  invoice_count integer not null default 0,
  line_count integer not null default 0,
  date_from text,
  date_to text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.datasets enable row level security;

create policy "datasets_select_all" on public.datasets for select using (true);
create policy "datasets_insert_all" on public.datasets for insert with check (true);
create policy "datasets_update_all" on public.datasets for update using (true);
create policy "datasets_delete_all" on public.datasets for delete using (true);
