"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Génération" },
  { href: "/qc", label: "QC" },
  { href: "/gallery", label: "Galerie" },
  { href: "/config", label: "Configuration" },
  { href: "/history", label: "Historique" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-zinc-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4">
        <Link href="/" className="mr-4 py-3 text-sm font-semibold tracking-tight">
          Showroom IA · <span className="text-zinc-500">GOODCAR</span>
        </Link>
        {LINKS.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
