"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui";

// Dialogue de confirmation IN-APP (et non `window.confirm`, supprimé/ignoré dans
// les PWA installées sur iOS : le bouton « Supprimer » semblait alors inopérant).
// Expose un `confirm()` asynchrone qui résout à true/false selon le choix.

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

const Ctx = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(
  null,
);

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const confirm = useContext(Ctx);
  if (!confirm)
    throw new Error("useConfirm doit être utilisé dans <ConfirmProvider>");
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  // Échap = annuler (clavier / claviers externes).
  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts, close]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => close(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-xl shadow-black/50">
            <h2 className="text-base font-semibold text-foreground">
              {opts.title}
            </h2>
            {opts.message ? (
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {opts.message}
              </p>
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => close(false)}>
                {opts.cancelLabel ?? "Annuler"}
              </Button>
              <Button
                variant={opts.danger ? "danger" : "primary"}
                onClick={() => close(true)}
              >
                {opts.confirmLabel ?? "Confirmer"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}
