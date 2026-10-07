import type { ReactNode } from 'react';
import { t } from '../../shared/i18n';
import { Button, IconButton } from '../../shared/ui/Button';
import { cn } from '../../shared/ui/cn';
import { fieldClass } from '../../shared/ui/field';
import { SettingsIcon } from '../../shared/ui/icons';

/**
 * Sticky search-first bar: identifier, one Scan button and ⚙ options, then a one-line options
 * summary (click opens the options). Progress and the options panel render below it.
 */
export function ScanBar({
  target,
  onTarget,
  targetDisabled,
  suggestions,
  scanLabel,
  scanDisabled,
  onScan,
  cancellable,
  onCancel,
  optionsOpen,
  onToggleOptions,
  summary,
  children,
}: {
  target: string;
  onTarget: (value: string) => void;
  targetDisabled: boolean;
  /** Field IDs from the current record for typeahead (local metadata only). */
  suggestions: string[];
  scanLabel: string;
  scanDisabled: boolean;
  onScan: () => void;
  cancellable: boolean;
  onCancel: () => void;
  optionsOpen: boolean;
  onToggleOptions: () => void;
  summary: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <input
          id="impact-target"
          aria-label={t('impact.target')}
          placeholder={t('impact.target')}
          className={cn(fieldClass, 'min-w-0 flex-1 font-mono')}
          value={target}
          maxLength={128}
          list={suggestions.length ? 'impact-target-suggestions' : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={targetDisabled}
          onChange={(event) => onTarget(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !scanDisabled) {
              event.preventDefault();
              onScan();
            }
          }}
        />
        {suggestions.length > 0 && (
          <datalist id="impact-target-suggestions">
            {suggestions.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        )}
        {cancellable ? (
          <Button onClick={onCancel}>{t('impact.cancel')}</Button>
        ) : (
          <Button variant="primary" disabled={scanDisabled} onClick={onScan}>
            {scanLabel}
          </Button>
        )}
        <IconButton
          label={t('impact.options')}
          icon={<SettingsIcon className="h-3.5 w-3.5" />}
          isSelected={optionsOpen}
          aria-expanded={optionsOpen}
          aria-controls="impact-options"
          onClick={onToggleOptions}
        />
      </div>
      <button
        type="button"
        onClick={onToggleOptions}
        aria-expanded={optionsOpen}
        aria-controls="impact-options"
        className="self-start truncate rounded-xs text-left text-xs text-fg-subtlest hover:text-fg"
      >
        {summary}
      </button>
      {children}
    </div>
  );
}
