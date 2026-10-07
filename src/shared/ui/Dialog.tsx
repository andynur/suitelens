import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ADS Modal dialog, sized for the narrow side panel: a full-panel overlay sheet with a fixed
 * header and footer and a scrolling body. Focus moves into the dialog on open, Tab stays
 * inside it, Escape calls `onClose`, and focus returns to the trigger when it unmounts.
 * Mount it to open, unmount it to close.
 */
export function Dialog({
  title,
  description,
  onClose,
  footer,
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !ref.current) return;
    const focusable = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex flex-col bg-surface-overlay text-fg shadow-overlay"
    >
      <div className="flex flex-col gap-1 border-b border-line p-3">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="text-xs text-fg-muted">
            {description}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-3">
          {footer}
        </div>
      )}
    </div>,
    document.body,
  );
}
