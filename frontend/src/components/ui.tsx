"use client";

import { ApiError } from "@/lib/api";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  // min-h-11 (44px) : cible tactile confortable.
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60";
  const variants: Record<string, string> = {
    primary:
      "bg-accent text-accent-contrast hover:bg-accent-strong active:bg-accent-strong",
    secondary:
      "border border-border bg-surface-2 text-foreground hover:border-accent/50 hover:bg-zinc-700/40",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-lg shadow-black/30 ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-2 border-t-accent" />
      {label ?? "Chargement…"}
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  const msg =
    error instanceof ApiError
      ? `${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {msg}
    </div>
  );
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "ok" | "ko" | "warn";
}) {
  const tones: Record<string, string> = {
    default: "bg-surface-2 text-muted",
    ok: "bg-emerald-500/15 text-emerald-300",
    ko: "bg-red-500/15 text-red-300",
    warn: "bg-amber-500/15 text-amber-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base text-foreground placeholder:text-zinc-500 outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent";
