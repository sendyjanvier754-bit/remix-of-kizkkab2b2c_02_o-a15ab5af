import React from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';

interface VariantPanelShellProps {
  /** Controls visibility. When false the component renders nothing. */
  isOpen: boolean;
  /** Called when the backdrop is clicked. */
  onClose: () => void;
  /**
   * Full content to render inside the panel.
   * Should follow the internal `flex flex-col` layout:
   *   - A `flex-shrink-0` header section
   *   - A `flex-1 overflow-y-auto` scrollable body
   *   - An (optional) `flex-shrink-0` sticky footer
   */
  children: React.ReactNode;
}

/**
 * Unified responsive variant panel shell used in CartPage and SellerCartPage.
 *
 * - Mobile: bottom sheet (`max-h-[90vh] rounded-t-2xl`)
 * - Desktop: right-side drawer (`w-[420px] h-screen`)
 * - Scroll lock is applied automatically while `isOpen` is true.
 * - The backdrop click triggers `onClose`.
 */
export function VariantPanelShell({ isOpen, onClose, children }: VariantPanelShellProps) {
  useScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className="
          fixed bg-background shadow-2xl flex flex-col z-[61]
          bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl
          md:top-0 md:bottom-auto md:left-auto md:right-0
          md:rounded-none md:border-l md:w-[420px] md:h-screen md:max-h-screen
        "
        role="dialog"
        aria-modal="true"
      >
        {children}
      </aside>
    </>
  );
}
