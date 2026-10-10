import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pama Convex MCP | Control plane foundation",
  description: "Security-first foundation for a multi-project Convex control plane. Not yet connected to managed deployments.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
