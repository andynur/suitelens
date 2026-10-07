import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { InfoIcon } from './icons';

/**
 * ⓘ button with a small popover for an explanation that would otherwise be a banner or a
 * helper paragraph. Opens on click (and keyboard), closes on Escape or outside click.
 */
export function InfoTip({
  label,
  children,
  align = 'start',
  className,
}: {
  label: string;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-fg-subtlest hover:bg-muted hover:text-fg"
      >
        <InfoIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className={cn(
            'absolute top-full z-30 mt-1 block w-64 max-w-[80vw] rounded-lg bg-surface-overlay p-3 text-left text-xs font-normal text-fg shadow-overlay',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
