"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Confirm";
import { Spinner } from "@/components/ui";
import {
  authEnabled,
  signInWith,
  signOut,
  supabase,
  type OAuthProvider,
} from "@/lib/supabase";

type Status = "loading" | "authed" | "anon";

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      {authEnabled ? (
        <div className="mx-auto flex w-full max-w-md justify-end px-4 pt-3">
          <button
            onClick={() => void signOut()}
            className="text-xs font-medium text-muted transition-colors hover:text-foreground"
          >
            Déconnexion
          </button>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-6">{children}</main>
      <BottomNav />
    </>
  );
}

function ProviderButton({
  provider,
  label,
}: {
  provider: OAuthProvider;
  label: string;
}) {
  const styles =
    provider === "apple"
      ? "bg-white text-black hover:bg-zinc-200"
      : "bg-surface-2 text-foreground border border-border hover:border-accent/50";
  return (
    <button
      onClick={() => void signInWith(provider)}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${styles}`}
    >
      {label}
    </button>
  );
}

function Login() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-contrast">
          GC
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Showroom IA
        </h1>
        <p className="mt-2 text-sm text-muted">GOODCAR — accès réservé</p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <ProviderButton provider="apple" label=" Se connecter avec Apple" />
        <ProviderButton provider="google" label="Se connecter avec Google" />
      </div>
      <p className="mt-8 text-center text-xs text-muted">
        Accès sur invitation uniquement.
      </p>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(authEnabled ? "loading" : "authed");

  useEffect(() => {
    if (!authEnabled || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "authed" : "anon");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? "authed" : "anon");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  let content: ReactNode;
  if (status === "loading") {
    content = (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Connexion…" />
      </div>
    );
  } else if (status === "anon") {
    content = <Login />;
  } else {
    content = <Shell>{children}</Shell>;
  }

  return (
    <ToastProvider>
      <ConfirmProvider>{content}</ConfirmProvider>
    </ToastProvider>
  );
}
