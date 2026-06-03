import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "Showroom IA — GOODCAR",
  description:
    "Génération de showroom virtuel IA pour véhicules : upload, QC, galerie, livraison Drive.",
  applicationName: "Showroom IA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Showroom IA",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        {/* AuthGate : écran de connexion (Google/Apple) si non authentifié,
            sinon le shell (colonne centrée max-w-md + bottom tab bar). */}
        <AuthGate>{children}</AuthGate>
        <ServiceWorker />
      </body>
    </html>
  );
}
