"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type DeliverResult } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  PageTitle,
  Spinner,
  SuccessBanner,
} from "@/components/ui";
import { JobPicker } from "@/components/JobPicker";
import { useToast } from "@/components/Toast";
import { getStoredJobId, useJob } from "@/lib/useJob";

export default function GalleryPage() {
  const [jobId, setJobId] = useState("");
  // Lecture du dernier job (localStorage) au montage — sync avec un store externe.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setJobId(getStoredJobId()), []);

  // Pas de polling : la galerie travaille sur des candidats stabilisés.
  const { data, error, loading } = useJob(jobId, false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState<unknown>(null);
  const [result, setResult] = useState<DeliverResult | null>(null);
  const toast = useToast();

  const photos = useMemo(() => data?.photos ?? [], [data]);
  const selectedSources = useMemo(
    () => photos.filter((p) => selected[p.id]).map((p) => p.source_name),
    [photos, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

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
    setResult(null);
    try {
      const r = await api.deliverJob(jobId, selectedSources);
      setResult(r);
      toast.success(
        `Livré : ${r.uploads.length} fichier(s) dans « ${r.folder_name} ».`,
      );
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
        title="Galerie de validation"
        subtitle="Cochez les candidats à livrer sur le Drive."
      />

      <JobPicker jobId={jobId} onChange={setJobId} />

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
          {result ? (
            <div className="mb-4">
              <SuccessBanner>
                Livré dans « {result.folder_name} » — {result.uploads.length}{" "}
                fichier(s) envoyé(s).
              </SuccessBanner>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 pb-20">
            {photos.map((p) => {
              const checked = !!selected[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`group overflow-hidden rounded-2xl border text-left transition-all ${
                    checked
                      ? "border-accent ring-2 ring-accent"
                      : "border-border hover:border-zinc-600"
                  }`}
                >
                  <div className="relative bg-surface-2">
                    {p.candidate_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.candidate_url}
                        alt={p.source_name}
                        className="aspect-[3/2] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[3/2] w-full items-center justify-center text-xs text-muted">
                        Aucun aperçu
                      </div>
                    )}
                    <span
                      className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                        checked
                          ? "bg-accent text-accent-contrast"
                          : "bg-black/60 text-transparent backdrop-blur group-hover:text-zinc-400"
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                  <div className="space-y-1 bg-surface p-2.5">
                    <p
                      className="truncate text-xs font-medium text-foreground"
                      title={p.source_name}
                    >
                      {p.target_filename ?? p.source_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.angle ? (
                        <span className="text-[11px] text-muted">{p.angle}</span>
                      ) : null}
                      {p.qc_verdict ? (
                        <Badge tone={p.qc_verdict === "ok" ? "ok" : "ko"}>
                          {p.qc_verdict}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </button>
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
              <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-border bg-surface/95 p-2 shadow-lg shadow-black/40 backdrop-blur-md">
                <Button
                  className="w-full"
                  onClick={deliver}
                  disabled={delivering}
                >
                  {delivering
                    ? "Livraison…"
                    : `Livrer la sélection (${selectedSources.length})`}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
