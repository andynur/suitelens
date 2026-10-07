import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** ADS Button appearances: primary, default (secondary), subtle (ghost), danger. */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-fg-inverse hover:bg-accent-hovered active:bg-accent-pressed',
  secondary: 'bg-muted text-fg-muted hover:bg-muted-hovered active:bg-muted-pressed',
  ghost: 'text-fg-muted hover:bg-muted active:bg-muted-hovered',
  danger: 'bg-danger-bold text-fg-inverse hover:bg-danger-bold-hovered',
};

const SELECTED = 'bg-selected text-accent hover:bg-selected-hovered';

/** ADS Button spacing: `compact` for dense toolbars (filter chips). */
type Spacing = 'default' | 'compact';

const SPACINGS: Record<Spacing, string> = {
  default: 'px-3 py-0.5 text-sm',
  compact: 'px-2 py-0.5 text-xs',
};

export function Button({
  variant = 'secondary',
  spacing = 'default',
  isSelected = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  spacing?: Spacing;
  isSelected?: boolean;
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        SPACINGS[spacing],
        isSelected ? SELECTED : VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/** ADS Icon button: square, subtle by default; `label` is the accessible name and tooltip. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  isSelected = false,
  type = 'button',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> & {
  label: string;
  icon: ReactNode;
  variant?: Variant;
  isSelected?: boolean;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
        isSelected ? SELECTED : VARIANTS[variant],
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
