import type { ReactNode } from "react";
import GlobalHeader from "@/components/layout/GlobalHeader";
import Footer from "@/components/layout/Footer";

export function NewsShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <GlobalHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export function formatNewsDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export const LANG_LABEL: Record<string, string> = { fr: "Français", ht: "Kreyòl", es: "Español", en: "English" };
