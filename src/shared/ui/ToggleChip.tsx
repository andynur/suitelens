import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';
import { CheckIcon } from './icons';

/**
 * Filter toggle (on/off). Pill shaped with a check mark and the selected color when on, so it
 * never looks like an action button. Exposes its state with `aria-pressed`.
 */
export function ToggleChip({
  pressed,
  onPressedChange,
  className,
  children,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'aria-pressed'> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type={type}
      aria-pressed={props.role === 'switch' ? undefined : pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        pressed
          ? 'border-accent bg-selected text-accent hover:bg-selected-hovered'
          : 'border-line bg-surface text-fg-muted hover:bg-muted',
        className,
      )}
      {...props}
    >
      {pressed && <CheckIcon className="h-3 w-3" />}
      {children}
    </button>
  );
}
