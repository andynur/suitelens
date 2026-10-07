import type { ReactNode } from 'react';
import { cn } from './cn';

/** ADS Lozenge (subtle appearance). */
type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'custom';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-fg-muted',
  info: 'bg-info-bg text-info',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  custom: 'bg-selected text-accent',
};

export const LOZENGE_CLASS =
  'inline-block max-w-[200px] truncate rounded-sm px-1 align-middle text-[11px] font-bold uppercase leading-4';

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn(LOZENGE_CLASS, TONES[tone])}>{children}</span>;
}
