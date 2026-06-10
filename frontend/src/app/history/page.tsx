"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function HistoryPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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
      // Réalisations = jobs validés/archivés + jobs ANNULÉS (trace des annulations).
      if (!j.archived_at && j.status !== "cancelled") return false;
      if (q && !jobLabel(j).toLowerCase().includes(q)) return false;
      if (from && j.created_at && new Date(j.created_at) < from) return false;
      return true;
    });
  }, [jobs, query, fromDate]);

  const download = async (j: Job) => {
    setDownloadingId(j.id);
    try {
      const blob = await api.downloadJob(j.id, []); // [] -> photos retenues
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${j.drive_folder ?? "showroom"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Téléchargement lancé.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléchargement.");
    } finally {
      setDownloadingId(null);
    }
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
        title="Réalisations"
        subtitle="Tous les véhicules traités (plus récent en premier)."
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
            {query || fromDate
              ? "Aucun résultat pour cette recherche."
              : "Aucune réalisation. Les véhicules apparaissent ici une fois validés (Téléchargés et archivés)."}
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
              {j.purged_at ? (
                // Rendus purgés du stockage après export : les photos vivent sur le Drive.
                <Button variant="secondary" disabled title="Photos disponibles sur le Drive">
                  Sur le Drive ✓
                </Button>
              ) : j.archived_at ? (
                <Button
                  variant="secondary"
                  disabled={downloadingId === j.id}
                  onClick={() => download(j)}
                >
                  {downloadingId === j.id ? "…" : "Télécharger"}
                </Button>
              ) : (
                // Job annulé non validé : rien à re-télécharger.
                <Button variant="secondary" disabled>
                  Annulé
                </Button>
              )}
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
