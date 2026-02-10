import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SellerSidebar } from "@/components/seller/SellerSidebar";
import Header from "@/components/layout/Header";
import SellerMobileHeader from "@/components/seller/SellerMobileHeader";
import SellerDesktopHeader from "@/components/seller/SellerDesktopHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEnsureSellerStore } from "@/hooks/useEnsureSellerStore";

interface SellerLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  headerVariant?: 'public' | 'seller';
  selectedCategoryId?: string | null;
  onCategorySelect?: (categoryId: string | null) => void;
  onSearch?: (query: string) => void;
}

export function SellerLayout({ 
  children, 
  showHeader = true,
  headerVariant = 'public',
  selectedCategoryId = null,
  onCategorySelect = () => {},
  onSearch 
}: SellerLayoutProps) {
  const isMobile = useIsMobile();
  // Automatically validate and create store if missing
  const { storeStatus, isValidating, shouldRedirectToOnboarding } = useEnsureSellerStore();

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <SellerSidebar />
        <main className="flex-1 w-full relative">
          {showHeader && (
            isMobile ? (
              <SellerMobileHeader 
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={onCategorySelect}
                onSearch={onSearch}
              />
            ) : (
              <Header 
                selectedCategoryId={selectedCategoryId}
                onCategorySelect={onCategorySelect}
              />
            )
          )}
          <div className="md:hidden fixed bottom-28 left-6 z-50">
            <SidebarTrigger className="bg-transparent hover:bg-gray-100 shadow-xl rounded-full w-10 h-10 border-2 border-[#071d7f]" style={{ color: '#071d7f' }} />
          </div>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
