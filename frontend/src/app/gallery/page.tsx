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
} from "@/components/ui";
import { JobPicker } from "@/components/JobPicker";
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

  const photos = useMemo(() => data?.photos ?? [], [data]);
  const selectedSources = useMemo(
    () => photos.filter((p) => selected[p.id]).map((p) => p.source_name),
    [photos, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const deliver = async () => {
    if (!jobId || selectedSources.length === 0) return;
    setDelivering(true);
    setDeliverError(null);
    setResult(null);
    try {
      setResult(await api.deliverJob(jobId, selectedSources));
    } catch (e) {
      setDeliverError(e);
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
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button
              onClick={deliver}
              disabled={delivering || selectedSources.length === 0}
            >
              {delivering
                ? "Livraison…"
                : `Livrer (${selectedSources.length})`}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setSelected(
                  Object.fromEntries(photos.map((p) => [p.id, true])),
                )
              }
            >
              Tout cocher
            </Button>
            <Button variant="ghost" onClick={() => setSelected({})}>
              Tout décocher
            </Button>
          </div>

          {deliverError ? (
            <div className="mb-4">
              <ErrorBanner error={deliverError} />
            </div>
          ) : null}
          {result ? (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Livré dans « {result.folder_name} » — {result.uploads.length}{" "}
              fichier(s) envoyé(s).
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => {
              const checked = !!selected[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`group overflow-hidden rounded-lg border bg-white text-left transition-all ${
                    checked
                      ? "border-zinc-900 ring-2 ring-zinc-900"
                      : "border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <div className="relative bg-zinc-100">
                    {p.candidate_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.candidate_url}
                        alt={p.source_name}
                        className="aspect-[3/2] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[3/2] w-full items-center justify-center text-xs text-zinc-400">
                        Aucun aperçu
                      </div>
                    )}
                    <span
                      className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        checked
                          ? "bg-zinc-900 text-white"
                          : "bg-white/80 text-transparent group-hover:text-zinc-300"
                      }`}
                    >
                      ✓
                    </span>
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="truncate text-xs font-medium" title={p.source_name}>
                      {p.target_filename ?? p.source_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {p.angle ? (
                        <span className="text-[11px] text-zinc-500">{p.angle}</span>
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
              <p className="text-sm text-zinc-500">
                Aucun candidat pour ce job.
              </p>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
