import { useAppStore } from '../store';

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-3 left-0 right-0 flex flex-col items-center gap-1"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="rounded-md bg-fg px-3 py-1.5 text-xs text-surface shadow-lg"
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}
