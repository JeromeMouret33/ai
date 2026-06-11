"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Photo } from "@/lib/api";
import {
  Button,
  Card,
  ErrorBanner,
  PageTitle,
  Spinner,
} from "@/components/ui";
import { JobPicker } from "@/components/JobPicker";
import { Lightbox } from "@/components/Lightbox";
import { useToast } from "@/components/Toast";
import { getStoredJobId, setStoredJobId, useJob } from "@/lib/useJob";

export default function GalleryPage() {
  const [jobId, setJobId] = useState("");
  // Lecture du dernier job (localStorage) au montage — sync avec un store externe.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setJobId(getStoredJobId()), []);

  // Polling : suit les régénérations en cours.
  const { data, error, loading } = useJob(jobId, true, 3000);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState<unknown>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const toast = useToast();

  const regenerate = async (p: Photo) => {
    setRetrying(p.id);
    try {
      await api.retryPhoto(p.id);
      toast.success(
        `Régénération lancée pour ${p.source_name} (depuis la photo d'origine).`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la régénération.");
    } finally {
      setRetrying(null);
    }
  };

  const photos = useMemo(() => data?.photos ?? [], [data]);
  const selectedSources = useMemo(
    () => photos.filter((p) => selected[p.id]).map((p) => p.source_name),
    [photos, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const saveZip = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data?.job?.drive_folder ?? "showroom"}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Valide : archive le job (-> Réalisations) + télécharge la sélection.
  const downloadAndArchive = async () => {
    if (!jobId) {
      toast.error("Aucun traitement sélectionné.");
      return;
    }
    if (selectedSources.length === 0) {
      toast.error("Coche au moins une photo.");
      return;
    }
    setDownloading(true);
    try {
      await api.archiveJob(jobId, selectedSources);
      saveZip(await api.downloadJob(jobId, selectedSources));
      toast.success("Téléchargé et archivé — disponible dans Réalisations.");
      setStoredJobId("");
      setJobId("");
      setSelected({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec.");
    } finally {
      setDownloading(false);
    }
  };

  const deliver = async () => {
    if (!jobId) {
      toast.error("Aucun job sélectionné.");
      return;
    }
    if (selectedSources.length === 0) {
      toast.error("Coche au moins une photo à livrer.");
      return;
    }
    setDelivering(true);
    setDeliverError(null);
    try {
      const r = await api.deliverJob(jobId, selectedSources);
      toast.success(
        `Exporté Drive (${r.uploads.length}) et archivé — dans Réalisations.`,
      );
      setStoredJobId("");
      setJobId("");
      setSelected({});
    } catch (e) {
      setDeliverError(e);
      toast.error(e instanceof Error ? e.message : "Échec de la livraison.");
    } finally {
      setDelivering(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Validation"
        subtitle="Ouvre chaque photo en grand pour vérifier, coche celles à garder, puis télécharge ou exporte. Régénère ce qui ne va pas."
      />

      {/* Validation = jobs pas encore archivés (à valider). */}
      <JobPicker
        jobId={jobId}
        onChange={setJobId}
        filter={(j) => !j.archived_at}
      />

      {loading && !data ? <Spinner /> : null}
      {error ? <ErrorBanner error={error} /> : null}

      {data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                setSelected(
                  Object.fromEntries(photos.map((p) => [p.id, true])),
                )
              }
            >
              Tout cocher
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setSelected({})}
            >
              Tout décocher
            </Button>
          </div>

          {deliverError ? (
            <div className="mb-4">
              <ErrorBanner error={deliverError} />
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 pb-20">
            {photos.map((p, idx) => {
              const checked = !!selected[p.id];
              return (
                <div
                  key={p.id}
                  className={`group relative overflow-hidden rounded-2xl border transition-all ${
                    checked ? "border-accent ring-2 ring-accent" : "border-border"
                  }`}
                >
                  {/* Zone image = ouvre la visionneuse. */}
                  <button
                    type="button"
                    onClick={() => setViewer(idx)}
                    className="relative block w-full bg-surface-2 text-left"
                  >
                    {p.candidate_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.candidate_url}
                        alt={p.source_name}
                        className="aspect-[3/2] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[3/2] w-full items-center justify-center text-xs text-muted">
                        {retrying === p.id ? "Régénération…" : "Aucun aperçu"}
                      </div>
                    )}
                  </button>
                  {/* Coche = sélection pour export (séparée de l'ouverture). */}
                  <button
                    type="button"
                    aria-label={checked ? "Retirer de la sélection" : "Garder"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(p.id);
                    }}
                    className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      checked
                        ? "bg-accent text-accent-contrast"
                        : "bg-black/60 text-zinc-300 backdrop-blur active:bg-black/80"
                    }`}
                  >
                    ✓
                  </button>

                  <div className="space-y-1.5 bg-surface p-2.5">
                    <p
                      className="truncate text-xs font-medium text-foreground"
                      title={p.source_name}
                    >
                      {p.target_filename ?? p.source_name}
                    </p>
                    {p.angle ? (
                      <span className="text-[11px] text-muted">{p.angle}</span>
                    ) : null}
                    {p.status === "error" && p.usage?.error ? (
                      <p className="break-words text-[11px] leading-snug text-red-400">
                        {p.usage.error}
                      </p>
                    ) : null}
                    <Button
                      variant="secondary"
                      className="min-h-9 w-full py-1.5 text-xs"
                      onClick={() => regenerate(p)}
                      disabled={retrying === p.id}
                    >
                      {retrying === p.id ? "Régénération…" : "Régénérer"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {photos.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">Aucun candidat pour ce job.</p>
            </Card>
          ) : null}

          {/* Barre de livraison fixe, pleine largeur, au-dessus de la tab bar. */}
          {photos.length > 0 ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-[72px] z-40 px-4">
              <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-2 gap-2 rounded-2xl border border-border bg-surface/95 p-2 shadow-lg shadow-black/40 backdrop-blur-md">
                <Button
                  className="w-full"
                  onClick={downloadAndArchive}
                  disabled={downloading}
                >
                  {downloading
                    ? "…"
                    : `Télécharger et archiver (${selectedSources.length})`}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={deliver}
                  disabled={delivering}
                >
                  {delivering ? "Drive…" : `Drive (${selectedSources.length})`}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {viewer !== null && photos.length > 0 ? (
        <Lightbox
          photos={photos}
          index={Math.min(viewer, photos.length - 1)}
          setIndex={setViewer}
          selected={selected}
          onToggle={toggle}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
