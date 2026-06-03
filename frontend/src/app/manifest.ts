import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Showroom IA — GOODCAR",
    short_name: "Showroom IA",
    description:
      "Showroom virtuel IA pour véhicules : génération, QC, galerie et livraison Drive.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
