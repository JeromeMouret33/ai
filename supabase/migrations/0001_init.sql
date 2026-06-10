-- Showroom IA — schéma initial (Phase 2)
-- Tables : jobs, photos, reference_assets. Buckets : references, uploads, outputs.
-- À appliquer via le SQL editor Supabase ou `supabase db push`.

-- =========================================================================
-- Tables
-- =========================================================================

-- Un job = un véhicule traité.
create table if not exists public.jobs (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    marque          text not null,
    modele          text not null,
    infos           text not null default '',
    drive_folder    text,            -- nom du dossier véhicule (nomenclature)
    drive_folder_id text,            -- id du dossier une fois créé sur Drive
    cost_total      double precision not null default 0,  -- coût cumulé du job (Phase 4)
    status          text not null default 'pending'
                    check (status in ('pending','processing','done','delivered','error'))
);

-- Une photo = une image source et son candidat généré.
create table if not exists public.photos (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    job_id          uuid not null references public.jobs(id) on delete cascade,
    source_name     text not null,           -- nom du fichier d'origine
    source_url      text,                    -- chemin/objet de la source (bucket uploads) — pour retry
    angle           text,                    -- slug d'angle détecté
    confidence      double precision,        -- confiance de classification
    attempts        integer not null default 0,
    candidate_url   text,                    -- URL signée du candidat retenu (servie à la lecture)
    candidate_path  text,                    -- chemin objet du candidat (bucket outputs privé)
    cost            double precision not null default 0,   -- coût de la photo (Phase 4)
    usage           jsonb not null default '{}'::jsonb,    -- usage OpenRouter (tokens…)
    target_filename text,                    -- nom de livraison (nomenclature)
    kept            boolean not null default false,   -- retenue (galerie de validation)
    status          text not null default 'pending'
                    check (status in ('pending','classified','generated','qc','delivered','error'))
);

create index if not exists photos_job_id_idx on public.photos(job_id);

-- Bibliothèque de références (showroom / logo / plaque), avec un asset actif par type.
create table if not exists public.reference_assets (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    type          text not null check (type in ('showroom','logo','plate')),
    name          text not null,
    url           text not null,             -- bucket references
    thumbnail_url text,
    active         boolean not null default false
);

-- Garantit qu'un seul asset est actif par type.
create unique index if not exists reference_assets_one_active_per_type
    on public.reference_assets(type) where active;

-- =========================================================================
-- Sécurité : Row Level Security
-- =========================================================================
-- On ACTIVE RLS sans créer de policy pour anon/authenticated : l'accès direct
-- via l'API publique (PostgREST + clé anon) est donc REFUSÉ. Le backend utilise
-- la clé `service_role` qui contourne RLS — c'est le seul chemin d'accès.
alter table public.jobs enable row level security;
alter table public.photos enable row level security;
alter table public.reference_assets enable row level security;

-- =========================================================================
-- Buckets de stockage (créés via l'API Storage ; rappel ici pour référence)
-- =========================================================================
--   references : assets de marque (showroom, logo, plaque) — PUBLIC
--   uploads    : photos sources déposées pour un job — PRIVÉ
--   outputs    : candidats générés — PRIVÉ (servis via URLs signées)
-- Création possible aussi en SQL :
insert into storage.buckets (id, name, public)
values ('references','references', true),
       ('uploads','uploads', false),
       ('outputs','outputs', false)
on conflict (id) do nothing;
