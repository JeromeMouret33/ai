"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type HistoryEntry } from "@/lib/api";
import {
  Button,
  Card,
  ErrorBanner,
  PageTitle,
  Spinner,
} from "@/components/ui";

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.getHistory());
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

  const remove = async (id: string) => {
    if (!window.confirm("Supprimer ce dossier sur le Drive ? Action définitive.")) {
      return;
    }
    setDeleting(id);
    setError(null);
    try {
      await api.deleteHistory(id);
      setEntries((prev) => prev?.filter((e) => e.id !== id) ?? null);
    } catch (e) {
      setError(e);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <PageTitle
        title="Historique"
        subtitle="Générations passées (dossiers Drive)."
      />

      <div className="mb-4">
        <Button variant="secondary" onClick={load} disabled={loading}>
          Rafraîchir
        </Button>
      </div>

      {loading ? <Spinner /> : null}
      {error ? (
        <div className="mb-4">
          <ErrorBanner error={error} />
        </div>
      ) : null}

      {entries && entries.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Aucune génération enregistrée.</p>
        </Card>
      ) : null}

      {entries && entries.length > 0 ? (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {e.name}
                  </p>
                  <p className="text-xs text-muted">
                    {e.createdTime
                      ? new Date(e.createdTime).toLocaleString("fr-FR")
                      : "—"}
                  </p>
                </div>
                <Button
                  variant="danger"
                  disabled={deleting === e.id}
                  onClick={() => remove(e.id)}
                >
                  {deleting === e.id ? "Suppression…" : "Supprimer"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
