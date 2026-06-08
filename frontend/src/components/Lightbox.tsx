"use client";

import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/api";

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Visionneuse plein écran : navigation, zoom (molette/pinch), garder synchronisé. */
export function Lightbox({
  photos,
  index,
  setIndex,
  selected,
  onToggle,
  onClose,
}: {
  photos: Photo[];
  index: number;
  setIndex: (i: number) => void;
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const touch = useRef<{
    x: number;
    y: number;
    mode: "swipe" | "pan" | "pinch";
    dist: number;
    scale: number;
    offset: { x: number; y: number };
  } | null>(null);

  const go = (delta: number) =>
    setIndex(clamp(index + delta, 0, photos.length - 1));

  // Reset du zoom quand on change d'image.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setScale(1);
    setOffset({ x: 0, y: 0 });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [index]);

  // Clavier : ←/→ navigue, Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  const photo = photos[index];
  if (!photo) return null;
  const kept = !!selected[photo.id];

  const twoFingerDist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    if (e.touches.length === 2) {
      touch.current = {
        x: 0, y: 0, mode: "pinch",
        dist: twoFingerDist(e.touches), scale, offset,
      };
    } else {
      const t = e.touches[0];
      touch.current = {
        x: t.clientX, y: t.clientY,
        mode: scale > 1 ? "pan" : "swipe",
        dist: 0, scale, offset,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const c = touch.current;
    if (!c) return;
    if (c.mode === "pinch" && e.touches.length === 2) {
      const s = clamp((c.scale * twoFingerDist(e.touches)) / c.dist, 1, 4);
      setScale(s);
      if (s === 1) setOffset({ x: 0, y: 0 });
    } else if (c.mode === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      setOffset({ x: c.offset.x + (t.clientX - c.x), y: c.offset.y + (t.clientY - c.y) });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    setDragging(false);
    const c = touch.current;
    touch.current = null;
    if (!c || c.mode !== "swipe") return;
    const dx = e.changedTouches[0].clientX - c.x;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  const onWheel = (e: React.WheelEvent) => {
    const s = clamp(scale - e.deltaY * 0.0015, 1, 4);
    setScale(s);
    if (s === 1) setOffset({ x: 0, y: 0 });
  };

  const arrow =
    "absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-2xl text-white backdrop-blur active:bg-black/70";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      {/* Barre haute : position + fermer */}
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)] text-sm text-zinc-200">
        <span className="font-medium">
          Photo {index + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg text-white active:bg-white/20"
        >
          ✕
        </button>
      </div>

      {/* Image (zoom/pan) */}
      <div
        className="relative flex-1 touch-none overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onDoubleClick={() => {
          setScale(scale > 1 ? 1 : 2.5);
          setOffset({ x: 0, y: 0 });
        }}
      >
        {photo.candidate_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.candidate_url}
            alt={photo.source_name}
            draggable={false}
            className="absolute inset-0 m-auto max-h-full max-w-full select-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging ? "none" : "transform 0.12s",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Aucun aperçu
          </div>
        )}

        {index > 0 ? (
          <button onClick={() => go(-1)} className={`${arrow} left-2`} aria-label="Précédent">
            ‹
          </button>
        ) : null}
        {index < photos.length - 1 ? (
          <button onClick={() => go(1)} className={`${arrow} right-2`} aria-label="Suivant">
            ›
          </button>
        ) : null}
      </div>

      {/* Barre basse : infos + garder */}
      <div className="space-y-2 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
        <p className="truncate text-xs text-zinc-400">
          {photo.angle ? `${photo.angle} · ` : ""}
          {photo.target_filename ?? photo.source_name}
          {photo.qc_verdict === "ko" ? " · ⚠ non conforme" : ""}
        </p>
        <button
          onClick={() => onToggle(photo.id)}
          className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
            kept
              ? "bg-accent text-accent-contrast"
              : "border border-border bg-surface text-foreground"
          }`}
        >
          {kept ? "✓ Gardée (à exporter)" : "Garder cette photo"}
        </button>
      </div>
    </div>
  );
}
