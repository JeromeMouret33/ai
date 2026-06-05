"use client";

import { useEffect, useState } from "react";
import { api, type Job } from "@/lib/api";
import { inputClass } from "@/components/ui";
import { setStoredJobId } from "@/lib/useJob";

/** Étiquette lisible d'un traitement : Client · Véhicule. */
export function jobLabel(j: Job): string {
  const client = [j.client_nom, j.client_prenom].filter(Boolean).join(" ").trim();
  const vehicle = [j.marque, j.modele].filter(Boolean).join(" ").trim();
  return [client || "Client ?", vehicle].filter(Boolean).join(" · ");
}

/** Sélecteur de traitement (remplace la saisie d'ID) — liste l'historique de l'app. */
export function JobPicker({
  jobId,
  onChange,
}: {
  jobId: string;
  onChange: (id: string) => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listJobs()
      .then(setJobs)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"));
  }, []);

  return (
    <div className="mb-6 space-y-1">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-foreground">
          Traitement
        </span>
        <select
          className={inputClass}
          value={jobId}
          onChange={(e) => {
            setStoredJobId(e.target.value);
            onChange(e.target.value);
          }}
        >
          <option value="">— Choisir un traitement —</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {jobLabel(j)}
              {j.photo_count != null ? ` · ${j.photo_count} ph.` : ""}
              {j.status ? ` · ${j.status}` : ""}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
