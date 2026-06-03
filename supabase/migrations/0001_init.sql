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
    status          text not null default 'pending'
                    check (status in ('pending','processing','done','delivered','error'))
);

-- Une photo = une image source et son candidat généré.
create table if not exists public.photos (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),
    job_id          uuid not null references public.jobs(id) on delete cascade,
    source_name     text not null,           -- nom du fichier d'origine
    angle           text,                    -- slug d'angle détecté
    confidence      double precision,        -- confiance de classification
    attempts        integer not null default 0,
    candidate_url   text,                    -- URL du candidat retenu (bucket outputs)
    target_filename text,                    -- nom de livraison (nomenclature)
    qc_verdict      text check (qc_verdict in ('ok','ko')),
    qc_reasons      jsonb not null default '[]'::jsonb,
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
-- Buckets de stockage (créés via l'API Storage ; rappel ici pour référence)
-- =========================================================================
--   references : assets de marque (showroom, logo, plaque)
--   uploads    : photos sources déposées pour un job
--   outputs    : candidats générés
-- Création possible aussi en SQL :
insert into storage.buckets (id, name, public)
values ('references','references', true),
       ('uploads','uploads', false),
       ('outputs','outputs', true)
on conflict (id) do nothing;
