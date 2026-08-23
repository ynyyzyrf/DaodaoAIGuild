import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "DaoDao AI Guild · 龍蝦騎士社區",
  description: "發現問題，召喚騎士。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
