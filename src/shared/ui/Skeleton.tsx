import { cn } from './cn';

/**
 * ADS Skeleton: placeholder shapes in the layout of the content being loaded, so the panel
 * does not jump when data arrives. Announces itself as a status with a hidden label.
 */
function Bone({ className }: { className?: string }) {
  return <span className={cn('block rounded-sm bg-muted', className)} />;
}

const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-1/3'] as const;

export function Skeleton({
  label,
  variant = 'rows',
  count = 6,
}: {
  label: string;
  variant?: 'rows' | 'cards';
  count?: number;
}) {
  const items = Array.from({ length: count }, (_, i) => WIDTHS[i % WIDTHS.length]!);
  return (
    <div role="status" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">{label}</span>
      {variant === 'rows' ? (
        <div aria-hidden className="flex flex-col">
          {items.map((width, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-line py-2">
              <Bone className={cn('h-3', width)} />
              <Bone className="h-3 w-4/5" />
              <Bone className={cn('h-3', WIDTHS[(i + 2) % WIDTHS.length])} />
            </div>
          ))}
        </div>
      ) : (
        <div aria-hidden className="flex flex-col gap-1.5">
          {items.map((width, i) => (
            <div
              key={i}
              className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3"
            >
              <Bone className={cn('h-3', width)} />
              <Bone className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
