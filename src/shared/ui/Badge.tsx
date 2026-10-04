import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'custom';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-fg-muted',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  custom: 'bg-accent/15 text-accent',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
