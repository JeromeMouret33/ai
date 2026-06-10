-- Showroom IA — suppression du QC automatique (validation 100% humaine).
-- Retire les colonnes liées au contrôle qualité de la table photos.
-- À appliquer dans le SQL Editor Supabase. Idempotent.

alter table public.photos drop column if exists qc_verdict;
alter table public.photos drop column if exists qc_reasons;
