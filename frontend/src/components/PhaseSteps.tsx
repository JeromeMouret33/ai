"use client";

import { Fragment } from "react";
import type { Photo } from "@/lib/api";

export type PhaseState = "pending" | "active" | "done" | "warn" | "failed";

interface Phase {
  key: "classif" | "gen";
  label: string;
  state: PhaseState;
}

// Poids relatifs (la génération est de loin la plus longue).
const WEIGHTS: Record<Phase["key"], number> = { classif: 1, gen: 6 };
const ACTIVE_CREDIT = 0.25; // crédit partiel d'une phase en cours

/** Dérive l'état des 2 phases d'une photo à partir des champs disponibles. */
export function photoPhases(p: Photo): Phase[] {
  const angle = !!p.angle;
  const hasCandidate = !!p.candidate_url;
  const errored = p.status === "error";

  // 1. Classification (identification de la vue) — rapide.
  let classif: PhaseState;
  if (angle) classif = "done";
  else if (errored) classif = "failed";
  else classif = "active";

  // 2. Génération IA — longue (terminale : pas de QC).
  let gen: PhaseState;
  if (hasCandidate) gen = "done";
  else if (errored && angle) gen = "failed";
  else if (angle) gen = "active";
  else gen = "pending";

  return [
    { key: "classif", label: "Vue", state: classif },
    { key: "gen", label: "Génération", state: gen },
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
      if (ph.state === "done" || ph.state === "failed") {
        done += w;
      } else if (ph.state === "active") {
        done += w * ACTIVE_CREDIT;
      }
    }
  }
  return Math.round((done / total) * 100);
}

/** Avancement d'UNE photo (0..100), pondéré : Vue 15 / Génération 85. */
export function photoProgress(p: Photo): number {
  const weights: Record<Phase["key"], number> = { classif: 15, gen: 85 };
  let pct = 0;
  for (const ph of photoPhases(p)) {
    const w = weights[ph.key];
    if (ph.state === "done" || ph.state === "failed") {
      pct += w;
    } else if (ph.state === "active") {
      pct += w * 0.5;
    }
  }
  return Math.round(pct);
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
