import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Menu } from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border">
            <div className="flex items-center gap-4 px-4 md:px-6 h-16">
              <SidebarTrigger className="md:hidden">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
              
              <div className="flex-1">
                <h1 className="text-lg md:text-xl font-bold text-foreground">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
