"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Job } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  inputClass,
  PageTitle,
  Spinner,
} from "@/components/ui";
import { jobLabel } from "@/components/JobPicker";
import { useToast } from "@/components/Toast";
import { setStoredJobId } from "@/lib/useJob";

export default function HistoryPage() {
  const router = useRouter();
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setJobs(await api.listJobs());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate) : null;
    return (jobs ?? []).filter((j) => {
      if (q && !jobLabel(j).toLowerCase().includes(q)) return false;
      if (from && j.created_at && new Date(j.created_at) < from) return false;
      return true;
    });
  }, [jobs, query, fromDate]);

  const open = (id: string) => {
    setStoredJobId(id);
    router.push("/gallery");
  };

  const remove = async (j: Job) => {
    if (
      !window.confirm(
        `Supprimer définitivement « ${jobLabel(j)} » de l'application (rendus inclus) ?`,
      )
    ) {
      return;
    }
    setDeleting(j.id);
    try {
      await api.deleteJob(j.id);
      setJobs((prev) => prev?.filter((x) => x.id !== j.id) ?? null);
      toast.success("Traitement supprimé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la suppression.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageTitle
        title="Historique"
        subtitle="Tous les traitements de l'application (plus récent en premier)."
      />

      {/* Recherche + filtre date */}
      <div className="mb-4 space-y-2">
        <input
          className={inputClass}
          placeholder="Rechercher (client, marque, modèle…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            className={inputClass}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          {fromDate ? (
            <Button variant="ghost" onClick={() => setFromDate("")}>
              Effacer
            </Button>
          ) : null}
          <Button variant="secondary" onClick={load} disabled={loading}>
            Rafraîchir
          </Button>
        </div>
      </div>

      {loading ? <Spinner /> : null}
      {error ? (
        <div className="mb-4">
          <ErrorBanner error={error} />
        </div>
      ) : null}

      {jobs && filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            {jobs.length === 0
              ? "Aucun traitement pour l'instant."
              : "Aucun résultat pour cette recherche."}
          </p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {filtered.map((j) => (
          <Card key={j.id}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {jobLabel(j)}
                </p>
                <p className="text-xs text-muted">
                  {j.created_at
                    ? new Date(j.created_at).toLocaleString("fr-FR")
                    : "—"}
                  {j.photo_count != null ? ` · ${j.photo_count} photo(s)` : ""}
                  {typeof j.cost_total === "number" && j.cost_total > 0
                    ? ` · ≈ $${j.cost_total.toFixed(3)}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge
                  tone={
                    j.status === "delivered" || j.status === "done"
                      ? "ok"
                      : j.status === "error"
                        ? "ko"
                        : j.status === "cancelled"
                          ? "warn"
                          : "default"
                  }
                >
                  {j.status === "cancelled" ? "annulé" : j.status}
                </Badge>
                {j.delivered_at ? (
                  <span className="text-[10px] text-emerald-400">exporté ✓</span>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => open(j.id)}>
                Ouvrir
              </Button>
              <Button
                variant="danger"
                disabled={deleting === j.id}
                onClick={() => remove(j)}
              >
                {deleting === j.id ? "…" : "Supprimer"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
