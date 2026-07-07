alter table public.pools drop column image_url;
alter table public.pools add column images text[] not null default '{}';
