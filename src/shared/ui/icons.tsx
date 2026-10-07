import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * Inline 16px stroke icons in the ADS glyph style (no icon font, no remote assets).
 * Icons are decorative: the control that holds one carries the accessible name.
 */
function Glyph({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4 shrink-0', className)}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export function InfoIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v4" />
      <circle cx="8" cy="5" r="0.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="5.25" y="5.25" width="8" height="8" rx="1.5" />
      <path d="M10.75 5.25V3.5a.75.75 0 0 0-.75-.75H3.5a.75.75 0 0 0-.75.75V10c0 .41.34.75.75.75h1.75" />
    </Glyph>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Glyph>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M13.25 8A5.25 5.25 0 1 1 11.7 4.3" />
      <path d="M13.25 2.75V5.5H10.5" />
    </Glyph>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m6 3.5 4.5 4.5L6 12.5" />
    </Glyph>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="7" cy="7" r="4.25" />
      <path d="m10.25 10.25 3 3" />
    </Glyph>
  );
}

/** "Show on page": a crosshair. */
export function LocateIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="8" cy="8" r="4.25" />
      <path d="M8 1.75v2M8 12.25v2M1.75 8h2M12.25 8h2" />
    </Glyph>
  );
}

/** Field ID badges on the NetSuite page: a tag. */
export function TagIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M2.75 2.75h5l5.5 5.5-5 5-5.5-5.5Z" />
      <circle cx="5.75" cy="5.75" r="0.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/**
 * SuiteLens product mark (assets/brand/logo-tile.svg) as an ADS product-logo tile.
 * Tokens only: brand-bold tile, inverse glyph, so it follows light and dark themes.
 */
export function LogoMark({ className }: IconProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-accent text-fg-inverse',
        className,
      )}
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" className="h-4 w-4">
        <circle cx="7" cy="7" r="4" strokeWidth="1.75" />
        <path d="M5.25 6h3.5M5.25 8.25h2" strokeWidth="1.25" strokeLinecap="round" />
        <path d="m10 10 3.25 3.25" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Command Palette: the ⌘ key. */
export function CommandIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M6 6V4.5A1.5 1.5 0 1 0 4.5 6H6Zm0 0h4M6 6v4m4-4V4.5A1.5 1.5 0 1 1 11.5 6H10Zm0 0v4m0 0h1.5a1.5 1.5 0 1 1-1.5 1.5V10Zm0 0H6m0 0v1.5A1.5 1.5 0 1 1 4.5 10H6Z" />
    </Glyph>
  );
}

/** Quick Go-to: open a record (arrow out of a box). */
export function GotoIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M9 2.75h4.25V7M13.25 2.75 7.5 8.5" />
      <path d="M11.5 9.5v3.25a.5.5 0 0 1-.5.5H3.25a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5H6.5" />
    </Glyph>
  );
}

/** Settings: two sliders. */
export function SettingsIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M2.75 4.5h6M12.25 4.5h1M2.75 11.5h1M7.25 11.5h6" />
      <circle cx="10.5" cy="4.5" r="1.75" />
      <circle cx="5.5" cy="11.5" r="1.75" />
    </Glyph>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
    </Glyph>
  );
}

/** Filters (funnel). */
export function FilterIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M2.75 3.75h10.5L9.25 8.5v3.75l-2.5 1V8.5Z" />
    </Glyph>
  );
}

/** SuiteQL console: a terminal prompt. */
export function ConsoleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect x="2.25" y="3" width="11.5" height="10" rx="1.5" />
      <path d="m5 6.5 1.75 1.5L5 9.5M8.5 10h2.5" />
    </Glyph>
  );
}

/** Download / export a file. */
export function DownloadIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M8 2.75v7M5 7l3 3 3-3M3 12.75h10" />
    </Glyph>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M8 3.25v9.5M3.25 8h9.5" />
    </Glyph>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m4.25 4.25 7.5 7.5M11.75 4.25l-7.5 7.5" />
    </Glyph>
  );
}

/** Quick Go-to by internal ID: a hash sign. */
export function HashIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M6.25 2.75 5 13.25M11 2.75 9.75 13.25M3 5.75h10.25M2.75 10.25H13" />
    </Glyph>
  );
}

/** Open the panel in a full browser tab: corner arrows. */
export function ExpandIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M9.5 2.75h3.75V6.5M13.25 2.75 9 7M6.5 13.25H2.75V9.5M2.75 13.25 7 9" />
    </Glyph>
  );
}

/** More actions: three horizontal dots. */
export function MoreIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="3.75" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12.25" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Home: a house outline. */
export function HomeIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M2.75 7.25 8 2.75l5.25 4.5M4.25 6v7.25h7.5V6" />
    </Glyph>
  );
}

/** AI assistant: a four-point sparkle. */
export function SparkleIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M8 2.25c.5 2.9 2.1 4.5 5 5-2.9.5-4.5 2.1-5 5-.5-2.9-2.1-4.5-5-5 2.9-.5 4.5-2.1 5-5Z" />
    </Glyph>
  );
}

/** Help: a question mark in a circle. */
export function HelpIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M6.25 6.25a1.75 1.75 0 1 1 2.5 1.6c-.5.25-.75.6-.75 1.15v.25" />
      <circle cx="8" cy="11.25" r="0.9" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** History: a clock with a back arrow. */
export function HistoryIcon({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.77" />
      <path d="M2.75 2.75v2.5h2.5M8 5.25V8l2 1.25" />
    </Glyph>
  );
}
