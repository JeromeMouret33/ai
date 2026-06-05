-- Showroom IA — refonte « historique app-centré » (2026-06-04)
-- À appliquer après 0001_init.sql (SQL editor Supabase ou `supabase db push`).

-- Identité client (clé d'identification des traitements dans l'app).
alter table public.jobs add column if not exists client_nom    text;
alter table public.jobs add column if not exists client_prenom text;

-- Horodatage de l'export Drive (null = non encore exporté).
alter table public.jobs add column if not exists delivered_at timestamptz;

-- Archivage : un job validé (téléchargé/exporté) passe en « Réalisations ».
-- null = encore « à valider » (visible dans Validation).
alter table public.jobs add column if not exists archived_at timestamptz;

-- Annulation de génération (flag lu par le traitement en tâche de fond).
alter table public.jobs add column if not exists cancel_requested boolean not null default false;

-- Autoriser le statut 'cancelled' (en plus des statuts initiaux).
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
    check (status in ('pending','processing','done','delivered','error','cancelled'));

-- Tri « plus récent en premier » de l'historique.
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);
