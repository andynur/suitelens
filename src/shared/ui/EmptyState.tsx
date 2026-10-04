import type { ReactNode } from 'react';

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center" role="status">
      <p className="text-sm font-semibold text-fg">{title}</p>
      {body && <p className="text-xs text-fg-muted">{body}</p>}
      {children}
    </div>
  );
}
