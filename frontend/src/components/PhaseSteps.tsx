"use client";

import { Fragment } from "react";
import type { Photo } from "@/lib/api";

export type PhaseState = "pending" | "active" | "done" | "warn" | "failed";

interface Phase {
  key: "classif" | "gen" | "qc";
  label: string;
  state: PhaseState;
}

// Poids relatifs (la génération est de loin la plus longue).
const WEIGHTS: Record<Phase["key"], number> = { classif: 1, gen: 6, qc: 1 };
const ACTIVE_CREDIT = 0.25; // crédit partiel d'une phase en cours

/** Dérive l'état des 3 phases d'une photo à partir des champs disponibles. */
export function photoPhases(p: Photo): Phase[] {
  const angle = !!p.angle;
  const hasCandidate = !!p.candidate_url;
  const verdict = p.qc_verdict ?? null;
  const errored = p.status === "error";

  // 1. Classification (identification de la vue) — rapide.
  let classif: PhaseState;
  if (angle) classif = "done";
  else if (errored) classif = "failed";
  else classif = "active";

  // 2. Génération IA — longue.
  let gen: PhaseState;
  if (hasCandidate) gen = "done";
  else if (errored && angle) gen = "failed";
  else if (angle) gen = "active";
  else gen = "pending";

  // 3. Contrôle qualité.
  let qc: PhaseState;
  if (verdict === "ok") qc = "done";
  else if (verdict === "ko") qc = "warn";
  else if (hasCandidate && errored) qc = "failed";
  else if (hasCandidate) qc = "active";
  else qc = "pending";

  return [
    { key: "classif", label: "Vue", state: classif },
    { key: "gen", label: "Génération", state: gen },
    { key: "qc", label: "QC", state: qc },
  ];
}

/** Avancement global pondéré (0..100). */
export function jobProgress(photos: Photo[]): number {
  if (photos.length === 0) return 0;
  let done = 0;
  let total = 0;
  for (const p of photos) {
    for (const ph of photoPhases(p)) {
      const w = WEIGHTS[ph.key];
      total += w;
      if (ph.state === "done" || ph.state === "warn" || ph.state === "failed") {
        done += w;
      } else if (ph.state === "active") {
        done += w * ACTIVE_CREDIT;
      }
    }
  }
  return Math.round((done / total) * 100);
}

const DOT: Record<PhaseState, { cls: string; icon: string }> = {
  pending: { cls: "bg-surface-2 text-zinc-500", icon: "•" },
  active: { cls: "bg-accent/20 text-accent animate-pulse", icon: "•" },
  done: { cls: "bg-emerald-500/20 text-emerald-300", icon: "✓" },
  warn: { cls: "bg-amber-500/20 text-amber-300", icon: "!" },
  failed: { cls: "bg-red-500/20 text-red-300", icon: "✕" },
};

export function PhaseSteps({ photo }: { photo: Photo }) {
  const phases = photoPhases(photo);
  return (
    <div className="flex items-center gap-1">
      {phases.map((ph, i) => (
        <Fragment key={ph.key}>
          <div className="flex flex-col items-center gap-1">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${DOT[ph.state].cls}`}
            >
              {DOT[ph.state].icon}
            </span>
            <span className="text-[10px] leading-none text-muted">
              {ph.label}
            </span>
          </div>
          {i < phases.length - 1 ? (
            <span
              className={`mb-4 h-px w-3 ${
                phases[i].state === "done" || phases[i].state === "warn"
                  ? "bg-accent/50"
                  : "bg-border"
              }`}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
