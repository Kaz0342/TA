import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: ReactNode;
}

/**
 * ModalPortal: Render dialog/modal langsung di document.body via React Portal.
 * Menghindari bug backdrop terpotong / stacking context isolation dari parent container dengan CSS transform/animation.
 */
export function ModalPortal({ children }: ModalPortalProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
