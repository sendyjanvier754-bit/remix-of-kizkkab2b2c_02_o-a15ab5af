import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GrossisteSidebar } from "./GrossisteSidebar";

interface GrossisteLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function GrossisteLayout({ children, title, subtitle }: GrossisteLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <GrossisteSidebar />
        <main className="flex-1 w-full">
          <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1">
              {title && <h1 className="text-lg font-semibold">{title}</h1>}
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </header>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}
