import type { ReactNode } from 'react';
import { cn } from './cn';

/** ADS Section message: in-page callout with icon, optional title and actions. */
type Appearance = 'information' | 'warning' | 'error' | 'success';

const STYLES: Record<Appearance, { box: string; accent: string }> = {
  information: { box: 'bg-info-bg', accent: 'text-info' },
  warning: { box: 'bg-warning-bg', accent: 'text-warning' },
  error: { box: 'bg-danger-bg', accent: 'text-danger' },
  success: { box: 'bg-success-bg', accent: 'text-success' },
};

function Icon({ appearance }: { appearance: Appearance }) {
  const common = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' } as const;
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="mt-0.5 h-4 w-4 shrink-0">
      {appearance === 'warning' ? (
        <path d="M8 1.75 14.75 14H1.25Z" {...common} strokeLinejoin="round" />
      ) : (
        <circle cx="8" cy="8" r="6.25" {...common} />
      )}
      {appearance === 'success' ? (
        <path d="m5.25 8.25 1.9 1.9 3.6-3.9" {...common} strokeLinejoin="round" />
      ) : appearance === 'information' ? (
        <>
          <path d="M8 7.25v4" {...common} />
          <circle cx="8" cy="5" r="0.9" fill="currentColor" />
        </>
      ) : (
        <>
          <path d={appearance === 'warning' ? 'M8 6.25v3.5' : 'M8 4.75v4'} {...common} />
          <circle cx="8" cy={appearance === 'warning' ? 11.75 : 11} r="0.9" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function SectionMessage({
  appearance = 'information',
  title,
  children,
  actions,
  role,
  className,
}: {
  appearance?: Appearance;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'alert' | 'alertdialog' | 'status';
  className?: string;
}) {
  const style = STYLES[appearance];
  return (
    <div
      role={role}
      data-banner={appearance}
      aria-label={role === 'alertdialog' ? title : undefined}
      className={cn('flex gap-2 rounded-lg p-3 text-xs text-fg', style.box, className)}
    >
      <span className={style.accent}>
        <Icon appearance={appearance} />
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className={cn('mb-0.5 font-semibold', style.accent)}>{title}</p>}
        {children}
        {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}
