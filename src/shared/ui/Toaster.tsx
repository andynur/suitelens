import { useAppStore } from '../store';

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-3 left-0 right-0 flex flex-col items-center gap-1.5"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="rounded-lg bg-surface-overlay px-4 py-2 text-sm text-fg shadow-overlay"
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
