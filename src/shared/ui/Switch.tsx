import * as RadixSwitch from '@radix-ui/react-switch';
import { useId } from 'react';

export function Switch({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <label htmlFor={id} className="text-xs">
        <span className="font-medium text-fg">{label}</span>
        {description && <span className="block text-fg-muted">{description}</span>}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line-input transition-colors data-[state=checked]:bg-accent disabled:pointer-events-none disabled:opacity-50"
      >
        <RadixSwitch.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-fg-inverse transition-transform data-[state=checked]:translate-x-[18px] motion-reduce:transition-none" />
      </RadixSwitch.Root>
    </div>
  );
}
