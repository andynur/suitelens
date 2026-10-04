import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent/90',
  secondary: 'border border-line bg-surface text-fg hover:bg-muted',
  ghost: 'text-fg hover:bg-muted',
  danger: 'border border-danger/40 text-danger hover:bg-danger/10',
};

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
