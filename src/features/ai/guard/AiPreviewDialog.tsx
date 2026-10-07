import { useMemo, useState } from 'react';
import { t } from '../../../shared/i18n';
import { useAppStore } from '../../../shared/store';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { fieldClass } from '../../../shared/ui/field';
import { SectionMessage } from '../../../shared/ui/SectionMessage';
import { Switch } from '../../../shared/ui/Switch';
import { cn } from '../../../shared/ui/cn';
import { AI_PROVIDER_CATALOG, providerHost } from '../catalog';
import { ProviderNotice } from '../ProviderNotice';
import { MAX_AI_PAYLOAD_CHARS, type PayloadItem } from '../types';
import { estimateTokens, formatPayload, redactText } from './redact';

export type AiPreviewDialogProps = {
  title: string;
  items: PayloadItem[];
  /** Cancelling sends nothing. */
  onCancel(): void;
  /** Final items after edits, removals and optional redaction. */
  onConfirm(items: PayloadItem[]): void;
};

type PreparedItem = { item: PayloadItem; sent: string; redactions: number };

/** Preview of everything that will be sent to the AI provider (F-5.10, F-5.11, F-5.12). */
export function AiPreviewDialog({
  title,
  items: initialItems,
  onCancel,
  onConfirm,
}: AiPreviewDialogProps) {
  const ai = useAppStore((s) => s.settings.ai);
  const [items, setItems] = useState(initialItems);
  const [redact, setRedact] = useState(ai.redact);

  const prepared = useMemo<PreparedItem[]>(
    () =>
      items.map((item) => {
        if (!redact) return { item, sent: item.content, redactions: 0 };
        const result = redactText(item.content);
        return { item, sent: result.text, redactions: result.count };
      }),
    [items, redact],
  );
  const finalItems = prepared.map(({ item, sent }) => ({ ...item, content: sent }));
  const payload = formatPayload(finalItems);
  const totalChars = payload.length;
  const totalTokens = estimateTokens(payload);
  const redactions = prepared.reduce((sum, p) => sum + p.redactions, 0);
  const tooLarge = totalChars > MAX_AI_PAYLOAD_CHARS;
  const canSend = items.length > 0 && !tooLarge;

  function edit(id: string, content: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, content } : item)));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      description={t('ai.guard.preview.description', {
        provider: AI_PROVIDER_CATALOG[ai.provider].label,
        model: ai.model,
        host: providerHost(ai.provider),
      })}
      footer={
        <>
          <span className="mr-auto text-xs text-fg-subtlest">
            {t('ai.guard.totalTokens', { tokens: totalTokens })}
          </span>
          <Button onClick={onCancel}>{t('app.cancel')}</Button>
          <Button variant="primary" disabled={!canSend} onClick={() => onConfirm(finalItems)}>
            {t('ai.guard.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Switch
          label={t('ai.guard.redact')}
          description={t('ai.guard.redact.desc')}
          checked={redact}
          onCheckedChange={setRedact}
        />
        {redact && (
          <p className="text-xs text-fg-subtlest" role="status">
            {t('ai.guard.redactCount', { count: redactions })}
          </p>
        )}
        <SectionMessage appearance="information">{t('ai.guard.recordNote')}</SectionMessage>
        <ProviderNotice provider={ai.provider} />
        {items.length === 0 && (
          <SectionMessage appearance="warning">{t('ai.guard.empty')}</SectionMessage>
        )}
        {tooLarge && (
          <SectionMessage appearance="error" role="alert">
            {t('ai.guard.tooLarge', { chars: totalChars, max: MAX_AI_PAYLOAD_CHARS })}
          </SectionMessage>
        )}
        <ul className="flex flex-col gap-2">
          {prepared.map(({ item, sent, redactions: count }) => (
            <li
              key={item.id}
              className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-3"
            >
              <div className="flex items-center gap-1">
                <Badge tone={item.kind === 'record' ? 'warning' : 'neutral'}>
                  {t(`ai.guard.kind.${item.kind}`)}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={item.label}>
                  {item.label}
                </span>
                <span className="shrink-0 text-xs text-fg-subtlest">
                  {t('ai.guard.itemTokens', { tokens: estimateTokens(sent) })}
                </span>
                {!item.required && (
                  <Button
                    variant="ghost"
                    spacing="compact"
                    aria-label={t('ai.guard.removeItem', { label: item.label })}
                    onClick={() => remove(item.id)}
                  >
                    {t('ai.guard.remove')}
                  </Button>
                )}
              </div>
              <textarea
                aria-label={t('ai.guard.itemContent', { label: item.label })}
                value={item.content}
                onChange={(event) => edit(item.id, event.target.value)}
                rows={Math.min(10, Math.max(2, item.content.split('\n').length))}
                spellCheck={false}
                className={cn(fieldClass, 'w-full resize-y font-mono')}
              />
              {count > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-fg-muted">{t('ai.guard.redactedPreview')}</span>
                  <pre
                    aria-label={t('ai.guard.redactedPreview')}
                    className="max-h-40 overflow-auto rounded-md bg-canvas p-2 font-mono text-xs whitespace-pre-wrap break-words"
                  >
                    {sent}
                  </pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
