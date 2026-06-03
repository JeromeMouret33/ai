"use client";

import { useEffect, useState } from "react";
import { api, type Photo } from "@/lib/api";
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

export default function QcPage() {
  const [jobId, setJobId] = useState("");
  // Lecture du dernier job (localStorage) au montage — sync avec un store externe.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setJobId(getStoredJobId()), []);

  const { data, error, loading, refresh } = useJob(jobId, true, 3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [kept, setKept] = useState<Record<string, boolean>>({});

  const flagged = (data?.photos ?? []).filter((p) => p.qc_verdict === "ko");

  const retry = async (p: Photo) => {
    setBusy(p.id);
    setActionError(null);
    try {
      await api.retryPhoto(p.id);
      await refresh();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageTitle
        title="QC interactif"
        subtitle="Photos signalées KO par le contrôle qualité. Validation humaine avant relance."
      />

      <JobPicker jobId={jobId} onChange={setJobId} />

      {loading && !data ? <Spinner /> : null}
      {error ? <ErrorBanner error={error} /> : null}
      {actionError ? (
        <div className="mb-4">
          <ErrorBanner error={actionError} />
        </div>
      ) : null}

      {data && flagged.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">
            Aucune photo en échec QC pour ce job.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {flagged.map((p) => {
          const isKept = kept[p.id];
          return (
            <Card key={p.id}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium" title={p.source_name}>
                  {p.source_name}
                </span>
                <Badge tone="ko">QC: KO</Badge>
              </div>

              <div className="mb-3 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                {p.candidate_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.candidate_url}
                    alt={p.source_name}
                    className="aspect-[3/2] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[3/2] w-full items-center justify-center text-sm text-zinc-400">
                    Aucun aperçu
                  </div>
                )}
              </div>

              {p.qc_reasons && p.qc_reasons.length > 0 ? (
                <ul className="mb-3 list-disc space-y-0.5 pl-5 text-sm text-zinc-600">
                  {p.qc_reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-zinc-400">Aucune raison fournie.</p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  disabled={busy === p.id}
                  onClick={() => retry(p)}
                >
                  {busy === p.id ? "Relance…" : "Relancer"}
                </Button>
                <Button
                  variant={isKept ? "primary" : "ghost"}
                  onClick={() =>
                    setKept((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                  }
                >
                  {isKept ? "Gardée ✓" : "Garder"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
