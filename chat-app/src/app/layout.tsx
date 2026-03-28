import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chat Hub",
  description: "Centralised multi-conversation chat with AI reply suggestions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased bg-gray-100 text-gray-900">
        {children}
      </body>
    </html>
  );
}
