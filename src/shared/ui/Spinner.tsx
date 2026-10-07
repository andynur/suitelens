/** ADS Spinner with a visible label; announces itself as a status. */
export function Spinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-6 text-xs text-fg-muted"
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="h-4 w-4 animate-spin motion-reduce:animate-none"
        fill="none"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path
          d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {label}
    </div>
  );
}
