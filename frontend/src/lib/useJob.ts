"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type JobDetail } from "@/lib/api";

const STORAGE_KEY = "showroom.activeJobId";

export function getStoredJobId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setStoredJobId(id: string): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STORAGE_KEY, id);
  else window.localStorage.removeItem(STORAGE_KEY);
}

const TERMINAL = new Set(["done", "delivered", "error", "complete", "completed"]);

/**
 * Charge un job et le rafraîchit toutes les `intervalMs` tant qu'il n'est pas
 * dans un état terminal. Polling actif uniquement si `poll` est vrai.
 */
export function useJob(jobId: string, poll = true, intervalMs = 3000) {
  const [data, setData] = useState<JobDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!jobId) return null;
    try {
      const detail = await api.getJob(jobId);
      setData(detail);
      setError(null);
      return detail;
    } catch (e) {
      // Un job introuvable (404) ne doit pas casser le polling silencieusement.
      setError(e);
      if (e instanceof ApiError && e.status === 404) return null;
      return null;
    }
  }, [jobId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchOnce();
    setLoading(false);
  }, [fetchOnce]);

  useEffect(() => {
    if (!jobId) {
      // Reset asynchrone : évite un setState synchrone dans le corps de l'effet.
      const id = setTimeout(() => setData(null), 0);
      return () => clearTimeout(id);
    }
    let cancelled = false;

    const tick = async () => {
      const detail = await fetchOnce();
      if (cancelled) return;
      const status = detail?.job.status ?? "";
      const allDone =
        detail != null &&
        detail.photos.length > 0 &&
        detail.photos.every((p) => TERMINAL.has(p.status));
      if (poll && !TERMINAL.has(status) && !allDone) {
        timer.current = setTimeout(tick, intervalMs);
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void tick().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId, poll, intervalMs, fetchOnce]);

  return { data, error, loading, refresh };
}
