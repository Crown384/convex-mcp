import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pama Convex MCP",
  description: "Sign in and manage your authorized Convex deployments.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
