"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type ReferenceAsset } from "@/lib/api";
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
import { useToast } from "@/components/Toast";
import { jobProgress, photoProgress, PhaseSteps } from "@/components/PhaseSteps";
import { getStoredJobId, setStoredJobId, useJob } from "@/lib/useJob";

// Coût OpenRouter en USD -> estimation EUR (indicative, taux surchargeable via env).
const EUR_PER_USD = Number(process.env.NEXT_PUBLIC_EUR_PER_USD ?? "0.92");

function statusTone(status: string): "default" | "ok" | "ko" | "warn" {
  if (["done", "complete", "completed", "delivered"].includes(status)) return "ok";
  if (status === "error") return "ko";
  if (["processing", "generating", "classifying", "qc"].includes(status))
    return "warn";
  return "default";
}

/** Vignette d'un fichier sélectionné (object URL révoqué au démontage). */
function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={file.name} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer ${file.name}`}
        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-zinc-200 backdrop-blur hover:text-red-400"
      >
        ✕
      </button>
    </div>
  );
}

export default function GenerationPage() {
  const [clientNom, setClientNom] = useState("");
  const [clientPrenom, setClientPrenom] = useState("");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [infos, setInfos] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [askedCancel, setAskedCancel] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [jobId, setJobId] = useState("");
  const toast = useToast();

  // Restaure le job en cours au montage : le suivi survit aux changements de page.
  useEffect(() => {
    const stored = getStoredJobId();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setJobId(stored);
  }, []);

  const { data, error, loading } = useJob(jobId, true, 3000);

  // Vérifie qu'un showroom + un logo actifs existent (requis pour générer).
  const [assets, setAssets] = useState<ReferenceAsset[] | null>(null);
  useEffect(() => {
    api.listAssets().then(setAssets).catch(() => setAssets(null));
  }, []);
  const activeShowroom = !!assets?.some((a) => a.type === "showroom" && a.active);
  const activeLogo = !!assets?.some((a) => a.type === "logo" && a.active);
  // assets===null : non chargé -> on ne bloque pas côté front (le backend tranchera).
  const refsMissing = assets !== null && (!activeShowroom || !activeLogo);

  const progressPct = data
    ? ["done", "delivered"].includes(data.job.status)
      ? 100
      : jobProgress(data.photos)
    : 0;

  // Job en cours (non terminal) -> on peut l'annuler.
  const running =
    !!data &&
    !["done", "delivered", "error", "cancelled"].includes(data.job.status);
  const cancelPending = askedCancel || !!data?.job?.cancel_requested;
  const generatedCount = (data?.photos ?? []).filter(
    (p) => !!p.candidate_url,
  ).length;

  const cancel = async () => {
    if (!jobId) return;
    setCancelling(true);
    try {
      await api.cancelJob(jobId);
      setAskedCancel(true);
      toast.success(
        "Annulation demandée — les photos restantes ne seront pas générées.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'annulation.");
    } finally {
      setCancelling(false);
    }
  };

  const addFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    // Snapshot SYNCHRONE : l'input est vidé (value="") juste après l'appel ;
    // il faut donc convertir la FileList maintenant, pas dans le setState (async).
    const picked = Array.from(list);
    if (picked.length === 0) return;
    setFiles((prev) => [...prev, ...picked]);
  }, []);

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation des champs obligatoires -> message clair sur ce qui manque.
    const missing: string[] = [];
    if (!clientNom.trim()) missing.push("le nom du client");
    if (!marque.trim()) missing.push("la marque");
    if (!modele.trim()) missing.push("le modèle");
    if (files.length === 0) missing.push("au moins une photo");
    if (assets !== null && !activeShowroom) missing.push("un showroom actif");
    if (assets !== null && !activeLogo) missing.push("un logo actif");
    if (missing.length > 0) {
      toast.error(`Il manque ${missing.join(", ")}.`);
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    setAskedCancel(false);
    try {
      const res = await api.createJob(
        marque,
        modele,
        infos,
        clientNom,
        clientPrenom,
        files,
      );
      setJobId(res.job_id);
      setStoredJobId(res.job_id);
      toast.success(
        `Génération lancée (${files.length} photo${files.length > 1 ? "s" : ""}).`,
      );
    } catch (err) {
      setSubmitError(err);
      toast.error(err instanceof Error ? err.message : "Échec du lancement.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !submitting;

  return (
    <div>
      <PageTitle
        title="Génération"
        subtitle="Photographiez ou importez les photos d'un véhicule pour lancer le pipeline showroom."
      />

      <div className="space-y-6">
        {refsMissing ? (
          <Card>
            <p className="text-sm text-amber-300">
              Avant de générer, il faut un <strong>showroom</strong> et un{" "}
              <strong>logo</strong> actifs.
              {!activeShowroom ? " Showroom actif manquant." : ""}
              {!activeLogo ? " Logo actif manquant." : ""}
            </p>
            <Link
              href="/config"
              className="mt-3 inline-block text-accent underline-offset-4 hover:underline"
            >
              → Aller à la configuration
            </Link>
          </Card>
        ) : null}

        <Card>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Client — Nom">
                <input
                  className={inputClass}
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  placeholder="Dupont"
                  required
                />
              </Field>
              <Field label="Prénom">
                <input
                  className={inputClass}
                  value={clientPrenom}
                  onChange={(e) => setClientPrenom(e.target.value)}
                  placeholder="Jean"
                />
              </Field>
            </div>
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
            <Field
              label="Infos"
              hint="Texte libre ajouté au nom du dossier Drive."
            >
              <input
                className={inputClass}
                value={infos}
                onChange={(e) => setInfos(e.target.value)}
                placeholder="2024 bleu"
              />
            </Field>

            {/* Deux gros boutons tactiles : caméra (mobile) + galerie. */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2/60 px-3 py-4 text-center text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-surface-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 text-accent"
                >
                  <path d="M3 7h3l2-2h8l2 2h3v12H3z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                Prendre une photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>

              <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2/60 px-3 py-4 text-center text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-surface-2">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-7 w-7 text-accent"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2.5" />
                  <circle cx="8.5" cy="9.5" r="1.5" />
                  <path d="M21 16l-5-5L5 20" />
                </svg>
                Importer
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {files.map((f, i) => (
                  <Thumb
                    key={`${f.name}-${f.lastModified}-${i}`}
                    file={f}
                    onRemove={() => removeFile(i)}
                  />
                ))}
              </div>
            )}

            {submitError ? <ErrorBanner error={submitError} /> : null}

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submitting
                ? "Envoi…"
                : `Lancer${files.length ? ` (${files.length} photo${files.length > 1 ? "s" : ""})` : ""}`}
            </Button>
          </form>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Progression
            </h2>
            {loading ? <Spinner /> : null}
          </div>

          {!jobId ? (
            <p className="text-sm text-muted">
              Aucun job en cours. Lancez une génération pour suivre
              l&apos;avancement.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {data?.job ? (
                  <Badge tone={statusTone(data.job.status)}>
                    {data.job.status}
                  </Badge>
                ) : null}
                {data?.job?.drive_folder ? (
                  <span className="font-medium text-foreground">
                    {data.job.drive_folder}
                  </span>
                ) : null}
              </div>

              {/* Barre d'avancement globale, pondérée (la génération pèse le plus). */}
              {data ? (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-right text-xs text-muted">{progressPct}%</p>
                </div>
              ) : null}

              {error ? <ErrorBanner error={error} /> : null}

              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {(data?.photos ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm"
                        title={p.source_name}
                      >
                        {p.target_filename ?? p.source_name}
                      </p>
                      <p className="text-[11px] text-muted">
                        {p.angle ? `${p.angle} · ` : ""}
                        {photoProgress(p)}%
                      </p>
                      {p.status === "error" && p.usage?.error ? (
                        <p className="mt-1 break-words text-[11px] leading-snug text-red-400">
                          {p.usage.error}
                        </p>
                      ) : null}
                    </div>
                    <PhaseSteps photo={p} />
                  </div>
                ))}
                {data && data.photos.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-muted">
                    En attente de traitement…
                  </p>
                ) : null}
              </div>

              {typeof data?.job?.cost_total === "number" &&
              data.job.cost_total > 0 &&
              generatedCount > 0 ? (
                <p className="text-xs text-muted">
                  La génération de {generatedCount} image
                  {generatedCount > 1 ? "s" : ""} a coûté ≈{" "}
                  {(data.job.cost_total * EUR_PER_USD).toFixed(2)} € (à titre
                  indicatif).
                </p>
              ) : null}

              {running ? (
                cancelPending ? (
                  <p className="text-center text-sm text-amber-300">
                    Annulation en cours… (la photo en cours se termine)
                  </p>
                ) : (
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={cancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Annulation…" : "Annuler la génération"}
                  </Button>
                )
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
