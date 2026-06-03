"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Field,
  inputClass,
  PageTitle,
  Spinner,
} from "@/components/ui";
import { setStoredJobId, useJob } from "@/lib/useJob";

function statusTone(status: string): "default" | "ok" | "ko" | "warn" {
  if (["done", "complete", "completed", "delivered"].includes(status)) return "ok";
  if (status === "error") return "ko";
  if (["processing", "generating", "classifying", "qc"].includes(status))
    return "warn";
  return "default";
}

export default function GenerationPage() {
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [infos, setInfos] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [jobId, setJobId] = useState("");

  const { data, error, loading } = useJob(jobId, true, 3000);

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }, []);

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await api.createJob(marque, modele, infos, files);
      setJobId(res.job_id);
      setStoredJobId(res.job_id);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = marque.trim() && modele.trim() && files.length > 0 && !submitting;

  return (
    <div>
      <PageTitle
        title="Génération"
        subtitle="Uploadez les photos d'un véhicule pour lancer le pipeline showroom."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Marque">
              <input
                className={inputClass}
                value={marque}
                onChange={(e) => setMarque(e.target.value)}
                placeholder="Peugeot"
                required
              />
            </Field>
            <Field label="Modèle">
              <input
                className={inputClass}
                value={modele}
                onChange={(e) => setModele(e.target.value)}
                placeholder="208 GT-Line"
                required
              />
            </Field>
            <Field label="Infos" hint="Texte libre ajouté au nom du dossier Drive.">
              <input
                className={inputClass}
                value={infos}
                onChange={(e) => setInfos(e.target.value)}
                placeholder="2024 bleu"
              />
            </Field>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
                dragging
                  ? "border-zinc-900 bg-zinc-50"
                  : "border-zinc-300 bg-zinc-50/50"
              }`}
            >
              <p className="text-zinc-600">
                Glissez-déposez les photos ici, ou
              </p>
              <label className="mt-2 inline-block cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-medium hover:bg-zinc-100">
                Parcourir…
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </label>
            </div>

            {files.length > 0 && (
              <ul className="max-h-44 space-y-1 overflow-auto rounded-md border border-zinc-200 p-2 text-sm">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-zinc-50"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-zinc-400 hover:text-red-600"
                      aria-label="Retirer"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {submitError ? <ErrorBanner error={submitError} /> : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? "Envoi…" : "Lancer"}
              </Button>
              <span className="text-xs text-zinc-400">
                {files.length} photo(s) sélectionnée(s)
              </span>
            </div>
          </form>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Progression</h2>
            {loading ? <Spinner /> : null}
          </div>

          {!jobId ? (
            <p className="text-sm text-zinc-500">
              Aucun job en cours. Lancez une génération pour suivre l&apos;avancement.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-xs text-zinc-500">{jobId}</span>
                {data?.job ? (
                  <Badge tone={statusTone(data.job.status)}>
                    {data.job.status}
                  </Badge>
                ) : null}
                {data?.job?.drive_folder ? (
                  <span className="text-zinc-500">→ {data.job.drive_folder}</span>
                ) : null}
              </div>

              {error ? <ErrorBanner error={error} /> : null}

              <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
                {(data?.photos ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate" title={p.source_name}>
                      {p.source_name}
                    </span>
                    {p.angle ? (
                      <span className="text-xs text-zinc-500">{p.angle}</span>
                    ) : null}
                    {typeof p.confidence === "number" ? (
                      <span className="text-xs text-zinc-400">
                        {Math.round(p.confidence * 100)}%
                      </span>
                    ) : null}
                    <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                  </div>
                ))}
                {data && data.photos.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-zinc-500">
                    En attente de traitement…
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3 pt-1 text-sm">
                <Link className="text-zinc-700 underline" href="/qc">
                  Aller au QC
                </Link>
                <Link className="text-zinc-700 underline" href="/gallery">
                  Galerie de validation
                </Link>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
