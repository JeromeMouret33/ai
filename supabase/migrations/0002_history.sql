-- Showroom IA — refonte « historique app-centré » (2026-06-04)
-- À appliquer après 0001_init.sql (SQL editor Supabase ou `supabase db push`).

-- Identité client (clé d'identification des traitements dans l'app).
alter table public.jobs add column if not exists client_nom    text;
alter table public.jobs add column if not exists client_prenom text;

-- Horodatage de l'export Drive (null = non encore exporté).
alter table public.jobs add column if not exists delivered_at timestamptz;

-- Tri « plus récent en premier » de l'historique.
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);
