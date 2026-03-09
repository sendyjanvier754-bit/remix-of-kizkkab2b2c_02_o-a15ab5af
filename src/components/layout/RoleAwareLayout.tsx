import { ReactNode } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { SellerLayout } from '@/components/seller/SellerLayout';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';

interface RoleAwareLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

/**
 * Layout wrapper that renders AdminLayout for admins and SellerLayout for other roles.
 * Use this for pages shared between admin and seller/agent roles.
 */
export function RoleAwareLayout({ children, title, subtitle }: RoleAwareLayoutProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN;

  if (isAdmin) {
    return (
      <AdminLayout title={title} subtitle={subtitle}>
        {children}
      </AdminLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="px-2 md:px-6 py-4">
        <h1 className="text-lg md:text-xl font-bold text-foreground mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>}
        {children}
      </div>
    </SellerLayout>
  );
}
