-- Showroom IA — persistance de la config éditable en base (survit aux déploiements).
-- Les fichiers YAML (prompt_fragments.yaml / params.yaml) restent les DÉFAUTS (seed).
-- Cette table stocke les SURCHARGES, fusionnées par-dessus au chargement.
-- Forme de `data` (miroir des fichiers) : {"params": {...}, "fragments": {...}}.
-- À appliquer dans le SQL Editor Supabase.

create table if not exists public.app_config (
    id         text primary key default 'main',
    data       jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

-- RLS : accès direct anon refusé ; seul le backend (service_role) écrit.
alter table public.app_config enable row level security;

insert into public.app_config (id, data) values ('main', '{}'::jsonb)
on conflict (id) do nothing;
