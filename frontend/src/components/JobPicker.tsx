"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Job } from "@/lib/api";
import { Button, inputClass } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { setStoredJobId } from "@/lib/useJob";

/** Étiquette lisible d'un traitement : Client · Véhicule. */
export function jobLabel(j: Job): string {
  const client = [j.client_nom, j.client_prenom].filter(Boolean).join(" ").trim();
  const vehicle = [j.marque, j.modele].filter(Boolean).join(" ").trim();
  return [client || "Client ?", vehicle].filter(Boolean).join(" · ");
}

/** Sélecteur de traitement : recherche/filtre + suppression (historique de l'app). */
export function JobPicker({
  jobId,
  onChange,
}: {
  jobId: string;
  onChange: (id: string) => void;
}) {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"));
  }, []);

  const selected = useMemo(
    () => jobs.find((j) => j.id === jobId) ?? null,
    [jobs, jobId],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs
      .filter((j) => !needle || jobLabel(j).toLowerCase().includes(needle))
      .slice(0, 50);
  }, [jobs, q]);

  const pick = (id: string) => {
    setStoredJobId(id);
    onChange(id);
    setSearching(false);
    setQ("");
  };

  const removeSelected = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        `Supprimer définitivement « ${jobLabel(selected)} » (rendus inclus) ?`,
      )
    )
      return;
    setDeleting(true);
    try {
      await api.deleteJob(selected.id);
      setJobs((prev) => prev.filter((j) => j.id !== selected.id));
      pick("");
      toast.success("Traitement supprimé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const showList = searching || !selected;

  return (
    <div className="mb-6 space-y-2">
      <span className="block text-sm font-medium text-foreground">Traitement</span>

      {selected && !searching ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm">
            {jobLabel(selected)}
          </div>
          <Button variant="ghost" onClick={() => setSearching(true)}>
            Changer
          </Button>
          <Button variant="danger" onClick={removeSelected} disabled={deleting}>
            {deleting ? "…" : "Suppr."}
          </Button>
        </div>
      ) : null}

      {showList ? (
        <>
          <input
            className={inputClass}
            placeholder="Rechercher un traitement (client, véhicule…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="max-h-64 divide-y divide-border overflow-auto rounded-xl border border-border">
            {filtered.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => pick(j.id)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2 ${
                  j.id === jobId ? "bg-surface-2" : ""
                }`}
              >
                <span className="min-w-0 truncate">{jobLabel(j)}</span>
                <span className="shrink-0 text-[11px] text-muted">
                  {j.photo_count != null ? `${j.photo_count} ph. · ` : ""}
                  {j.status}
                </span>
              </button>
            ))}
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted">Aucun traitement.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
