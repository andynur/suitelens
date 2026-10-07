import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';
import { MoreIcon } from './icons';

export type MenuItem = {
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * Small action menu (ADS dropdown menu). The trigger is an icon button with `label` as its
 * accessible name and tooltip, or a text button when `text` is set. Arrow keys move, Escape
 * closes and returns focus to the trigger.
 */
export function Menu({
  label,
  items,
  text,
  icon,
  align = 'end',
  className,
}: {
  label: string;
  items: MenuItem[];
  text?: ReactNode;
  icon?: ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => entries[(next + entries.length) % entries.length]?.focus();
    if (event.key === 'ArrowDown') move(index + 1);
    else if (event.key === 'ArrowUp') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(entries.length - 1);
    else if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'Tab') setOpen(false);
    else return;
    if (event.key !== 'Tab') event.preventDefault();
  };

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={text ? undefined : label}
        title={label}
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center justify-center gap-1 rounded-sm text-fg-muted transition-colors hover:bg-muted',
          text ? 'bg-muted px-2 py-0.5 text-xs font-medium' : 'h-6 w-6',
          open && 'bg-selected text-accent',
        )}
      >
        {icon ?? (text ? null : <MoreIcon />)}
        {text}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn(
            'absolute top-full z-30 mt-1 min-w-48 max-w-72 rounded-lg bg-surface-overlay py-1 shadow-overlay',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-muted focus-visible:bg-muted disabled:opacity-50"
            >
              {item.icon && <span className="mt-0.5 text-fg-muted">{item.icon}</span>}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-fg">{item.label}</span>
                {item.description && (
                  <span className="text-xs text-fg-subtlest">{item.description}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
