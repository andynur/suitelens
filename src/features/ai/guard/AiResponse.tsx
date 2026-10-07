import type { ReactNode } from 'react';
import { getLocale, t } from '../../../shared/i18n';
import { Button } from '../../../shared/ui/Button';
import { ErrorPanel } from '../../../shared/ui/ErrorPanel';
import { SectionMessage } from '../../../shared/ui/SectionMessage';
import { Spinner } from '../../../shared/ui/Spinner';
import type { AiRun } from '../useAiRequest';
import { AiPreviewDialog } from './AiPreviewDialog';

export type TextBlock =
  { type: 'text'; text: string } | { type: 'code'; lang: string; code: string };

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)[^`]*$/;

/**
 * Splits Markdown-ish AI text into prose and fenced code blocks, in order. An unclosed fence
 * (common while streaming) runs to the end of the text. Features reuse this to pull out
 * e.g. the ```sql block of an answer.
 */
export function splitFencedBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const lines = text.split('\n');
  let prose: string[] = [];
  const flushProse = () => {
    const joined = prose.join('\n');
    if (joined.trim()) blocks.push({ type: 'text', text: joined.replace(/^\n+|\n+$/g, '') });
    prose = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const open = FENCE_OPEN.exec(lines[i]!);
    if (!open) {
      prose.push(lines[i]!);
      continue;
    }
    flushProse();
    const fence = open[1]!;
    const close = new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
    const code: string[] = [];
    i += 1;
    while (i < lines.length && !close.test(lines[i]!)) {
      code.push(lines[i]!);
      i += 1;
    }
    blocks.push({ type: 'code', lang: (open[2] ?? '').toLowerCase(), code: code.join('\n') });
  }
  flushProse();
  return blocks;
}

/** Renders AI text as plain React text nodes: paragraphs and `<pre><code>` blocks. */
export function AiText({
  text,
  renderCode,
}: {
  text: string;
  renderCode?: (code: string, lang: string) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 text-xs text-fg">
      {splitFencedBlocks(text).map((block, index) =>
        block.type === 'code' ? (
          <div key={index} className="flex flex-col gap-1">
            {block.lang && (
              <span className="text-xs text-fg-subtlest">
                {t('ai.guard.codeBlock', { lang: block.lang })}
              </span>
            )}
            <pre className="overflow-x-auto rounded-md border border-line bg-canvas p-2 font-mono text-xs">
              <code>{block.code}</code>
            </pre>
            {renderCode?.(block.code, block.lang)}
          </div>
        ) : (
          block.text.split(/\n\s*\n/).map((paragraph, p) => (
            <p key={`${index}-${p}`} className="break-words whitespace-pre-wrap">
              {paragraph}
            </p>
          ))
        ),
      )}
    </div>
  );
}

/**
 * Reusable view for an `AiRun`: the preview dialog, streaming text with Cancel, the final
 * answer with usage and stop-reason warnings, errors with Retry, and the cancelled note.
 * AI output is always rendered as text, never as HTML.
 */
export function AiResponse({
  run,
  title,
  renderCode,
}: {
  run: AiRun;
  /** Title of the preview dialog. */
  title: string;
  renderCode?: (code: string, lang: string) => ReactNode;
}) {
  const { state } = run;
  if (state.status === 'idle') return null;
  if (state.status === 'preview') {
    return (
      <AiPreviewDialog
        title={title}
        items={state.items}
        onCancel={run.cancelPreview}
        onConfirm={run.confirm}
      />
    );
  }

  const number = (value: number) => value.toLocaleString(getLocale());
  const stopReason = state.result?.stopReason;
  return (
    <section
      aria-label={t('ai.guard.response')}
      aria-busy={state.status === 'streaming'}
      className="flex flex-col gap-2"
    >
      {state.status === 'error' && state.error && (
        <ErrorPanel error={state.error} onRetry={() => run.preview(state.items)} />
      )}
      {state.status === 'streaming' && (
        <div className="flex items-center justify-between gap-2">
          <Spinner label={t('ai.guard.streaming')} />
          <Button onClick={run.cancel}>{t('app.cancel')}</Button>
        </div>
      )}
      {state.status === 'cancelled' && (
        <p role="status" className="text-xs text-fg-muted">
          {t('ai.guard.cancelled')}
        </p>
      )}
      {stopReason === 'refusal' && (
        <SectionMessage appearance="warning" title={t('ai.guard.refusal.title')}>
          {t('ai.guard.refusal.body')}
        </SectionMessage>
      )}
      {state.text && <AiText text={state.text} renderCode={renderCode} />}
      {stopReason === 'max_tokens' && (
        <SectionMessage appearance="warning" title={t('ai.guard.truncated.title')}>
          {t('ai.guard.truncated.body')}
        </SectionMessage>
      )}
      {state.status === 'done' && state.result && (
        <p className="text-xs text-fg-subtlest">
          {t('ai.guard.usage', {
            input: number(state.result.usage.inputTokens),
            output: number(state.result.usage.outputTokens),
          })}
        </p>
      )}
    </section>
  );
}
