import { useEffect, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { SuiteLensError, toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import {
  pdfEditorId,
  validatePdfEditorSource,
  type PdfEditorSource,
} from '../../netsuite/impact/pdfEditor';
import { SOURCE_LIMITS } from '../../netsuite/impact/source';
import type { PageContext } from '../../netsuite/types';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { Spinner } from '../../shared/ui/Spinner';
import { scanReferences, type ReferenceScan } from './references';

type EditorResult = { source: Omit<PdfEditorSource, 'content'>; scan: ReferenceScan };

type Props = { adapter: NetSuiteAdapter; context: PageContext; target: string; disabled: boolean };

/** Remount transient state whenever its owner changes. */
export function PdfEditorScan(props: Props) {
  const [owner, setOwner] = useState({ adapter: props.adapter, revision: 0 });
  if (owner.adapter !== props.adapter) {
    setOwner({ adapter: props.adapter, revision: owner.revision + 1 });
    return null;
  }
  const key = JSON.stringify([
    owner.revision,
    props.context.accountId,
    props.context.url,
    props.target,
  ]);
  return <EditorScan key={key} {...props} />;
}

/** Explicit, transient editor scan, separate from persisted File Cabinet plans. */
function EditorScan({ adapter, context, target, disabled }: Props) {
  const editorId = pdfEditorId(context.url);
  const [result, setResult] = useState<EditorResult>();
  const [error, setError] = useState<SuiteLensErrorShape>();
  const [running, setRunning] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const epochRef = generation;
    return () => {
      epochRef.current++;
    };
  }, []);

  const run = async () => {
    if (editorId === undefined || disabled || pending.current) return;
    const epoch = ++generation.current;
    pending.current = true;
    setRunning(true);
    setResult(undefined);
    setError(undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = { accountId: context.accountId, editorId };
      const raw = await Promise.race([
        adapter.readImpactPdfEditor(request),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new SuiteLensError('TIMEOUT', 'PDF editor read timed out.')),
            SOURCE_LIMITS.timeoutMs,
          );
        }),
      ]);
      if (epoch !== generation.current) return;
      const source = validatePdfEditorSource(raw, context.url, request);
      const current = await adapter.getPageContext();
      if (epoch !== generation.current) return;
      if (current?.accountId !== context.accountId || current.url !== context.url)
        throw new SuiteLensError('ACCOUNT_MISMATCH', 'Target changed during the PDF editor scan.');
      const scan = scanReferences(source.content, target.trim(), 'pdf-template', {
        includeExcerpts: false,
      });
      const { content: _content, ...metadata } = source;
      setResult({ source: metadata, scan });
    } catch (err) {
      if (epoch === generation.current) setError(toSuiteLensError(err).toShape());
    } finally {
      clearTimeout(timer);
      pending.current = false;
      setRunning(false);
    }
  };
  if (editorId === undefined) return null;
  return (
    <section
      aria-label={t('impact.pdfEditor')}
      className="m-3 flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs"
    >
      <h3 className="font-semibold text-fg-muted">{t('impact.pdfEditor')}</h3>
      <p className="text-fg-muted">{t('impact.pdfEditorHelp')}</p>
      <div>
        <Button disabled={disabled || running} onClick={() => void run()}>
          {t('impact.scanPdfEditor')}
        </Button>
      </div>
      {running && <Spinner label={t('impact.readingPdfEditor')} />}
      {error && <ErrorPanel error={error} onRetry={() => void run()} />}
      {result && (
        <>
          <p>
            {result.source.state === 'unsaved'
              ? t('impact.pdfUnsaved')
              : t('impact.pdfTemplateIdentity', { id: result.source.templateId! })}
          </p>
          <p className="text-fg-subtlest">{t('impact.pdfSnapshot')}</p>
          <a
            className="text-accent hover:underline"
            href={result.source.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('impact.openPdfEditor')} ↗
          </a>
          {result.scan.status === 'not-checked' && <p>{t('impact.limit')}</p>}
          <p>
            {result.scan.hits.length
              ? t('impact.hitCount', { count: result.scan.hits.length })
              : t('impact.pdfNoHits')}
          </p>
          <ul className="flex flex-col gap-1">
            {result.scan.hits.map((hit) => (
              <li key={`${hit.offset}:${hit.kind}`}>
                {t('impact.hit', { line: hit.line, column: hit.column })}
                <span className="block text-fg-subtlest">{t(`impact.${hit.kind}`)}</span>
              </li>
            ))}
          </ul>
          <p className="text-fg-muted">{t('impact.pdfCoverage')}</p>
        </>
      )}
    </section>
  );
}
