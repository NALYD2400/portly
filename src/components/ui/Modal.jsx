import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

/**
 * Socle unique pour toutes les modals de l'app.
 * Gère : fermeture Escape, focus trap, aria-modal, verrou du scroll,
 * clic sur le backdrop et bouton de fermeture.
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  dismissible = true,
  showCloseButton = false,
  align = 'center',
  maxWidth = 'max-w-lg',
  labelledBy,
  panelClassName = '',
  backdropClassName = '',
}) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus initial sur le premier élément interactif (ou le panneau)
    const focusFrame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.setAttribute('tabindex', '-1');
        panel.focus();
      }
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (dismissible) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || !panelRef.current.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, dismissible]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
      className={`fixed inset-0 z-50 bg-black/75 flex justify-center p-4 select-none animate-fadeIn ${backdropClassName} ${
        align === 'top' ? 'items-start pt-20' : 'items-center'
      }`}
    >
      <div
        ref={panelRef}
        className={`modal-panel cursor-default animate-scaleUp ${maxWidth} ${panelClassName}`}
      >
        {showCloseButton && (
          <div className="flex justify-end px-4 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={!dismissible}
              aria-label="Fermer"
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
