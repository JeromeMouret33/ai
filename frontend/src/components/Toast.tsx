"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type ToastType = "error" | "success" | "info";
interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const Ctx = createContext<((type: ToastType, message: string) => void) | null>(
  null,
);

export function useToast(): ToastApi {
  const push = useContext(Ctx);
  if (!push) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return {
    error: (m) => push("error", m),
    success: (m) => push("success", m),
    info: (m) => push("info", m),
  };
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback(
    (id: number) => setItems((p) => p.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = ++counter;
      setItems((p) => [...p, { id, type, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastView({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const tones: Record<ToastType, string> = {
    error: "border-red-500/40 bg-red-500/15 text-red-100",
    success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
    info: "border-accent/40 bg-surface text-foreground",
  };
  const icons: Record<ToastType, string> = {
    error: "!",
    success: "✓",
    info: "i",
  };

  return (
    <div
      onClick={onClose}
      role="status"
      className={`pointer-events-auto w-full max-w-sm cursor-pointer rounded-xl border px-4 py-3 text-sm shadow-lg shadow-black/50 backdrop-blur transition-all duration-300 ${tones[item.type]} ${shown ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/30 text-xs font-bold">
          {icons[item.type]}
        </span>
        <span className="leading-snug">{item.message}</span>
      </div>
    </div>
  );
}
