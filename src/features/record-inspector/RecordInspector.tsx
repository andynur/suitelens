import { RecordCompare } from './RecordCompare';
import { maskPayload, payloadFilename, serializePayloadXml } from './payloadExport';
import { copyWithToast } from '../../shared/ui/clipboard';
import { downloadLocal } from '../../shared/ui/download';
import { useAppStore } from '../../shared/store';
import { SearchHighlight } from '../../shared/ui/SearchHighlight';
import { useMemo, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import { readRecordPayload, type RecordPayloadNode } from '../../netsuite/parsers/recordPayload';
import type { PageContext } from '../../netsuite/types';
import { useAsync } from '../../shared/hooks/useAsync';
import { t } from '../../shared/i18n';
import { Button, IconButton } from '../../shared/ui/Button';
import { cn } from '../../shared/ui/cn';
import { CopyIcon, DownloadIcon, RefreshIcon } from '../../shared/ui/icons';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { fieldClass } from '../../shared/ui/field';
import { Skeleton } from '../../shared/ui/Skeleton';
import { InfoTip } from '../../shared/ui/InfoTip';
import { ToggleChip } from '../../shared/ui/ToggleChip';

/** XML is the saved server record, not the form's unsaved edit buffer. No payload storage. */
export function RecordInspector({
  adapter,
  context,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext & { recordType: string };
}) {
  const [format, setFormat] = useState<'xml' | 'json'>('json');
  const [search, setSearch] = useState('');
  const [masked, setMasked] = useState(false);
  const [comparing, setComparing] = useState(false);
  const toast = useAppStore((store) => store.toast);
  const state = useAsync(
    async () =>
      readRecordPayload(
        await adapter.getRecordXml(
          { recordType: context.recordType, id: context.recordId },
          context.accountId,
        ),
      ),
    context.recordId
      ? JSON.stringify([
          adapter.kind,
          context.accountId,
          context.recordType,
          context.recordId,
          context.url,
        ])
      : null,
  );
  const payload = useMemo(
    () => state.data && (masked ? maskPayload(state.data.json) : state.data.json),
    [state.data, masked],
  );
  const exportText = payload
    ? format === 'json'
      ? JSON.stringify(payload, null, 2)
      : masked
        ? serializePayloadXml(payload)
        : state.data?.xml
    : undefined;
  const tree = useMemo(() => {
    if (!payload) return undefined;
    const full = format === 'xml' ? xmlTree(payload) : jsonTree(payload);
    return filterTree(full, search.trim().toLowerCase());
  }, [payload, format, search]);

  if (!context.recordId)
    return <EmptyState title={t('inspector.saved.title')} body={t('inspector.saved.body')} />;

  return (
    <section aria-label={t('inspector.title')}>
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-line bg-canvas p-3">
        <h2 className="sr-only">{t('inspector.title')}</h2>
        <div className="flex items-center gap-2">
          <input
            type="search"
            aria-label={t('inspector.search')}
            placeholder={t('inspector.search')}
            className={cn(fieldClass, 'min-w-0 flex-1')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex shrink-0 items-center gap-0.5 rounded-sm bg-muted p-0.5">
            {(['xml', 'json'] as const).map((option) => (
              <Button
                key={option}
                spacing="compact"
                variant="ghost"
                isSelected={format === option}
                aria-pressed={format === option}
                onClick={() => setFormat(option)}
              >
                {t(option === 'xml' ? 'inspector.xml' : 'inspector.json')}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ToggleChip
            role="switch"
            aria-checked={masked}
            aria-label={t('inspector.mask')}
            title={t('inspector.maskNotice')}
            pressed={masked}
            onPressedChange={setMasked}
          >
            {t('inspector.mask')}
          </ToggleChip>
          <InfoTip label={t('inspector.about')}>{t('inspector.notice')}</InfoTip>
          <span className="ml-auto flex items-center gap-1">
            <Button
              spacing="compact"
              variant="ghost"
              aria-expanded={comparing}
              isSelected={comparing}
              onClick={() => setComparing(!comparing)}
            >
              {t('inspector.compare.action')}
            </Button>
            <IconButton
              label={t('app.refresh')}
              icon={<RefreshIcon className="h-3.5 w-3.5" />}
              onClick={() => state.reload(true)}
            />
            <IconButton
              label={t('inspector.copy')}
              icon={<CopyIcon className="h-3.5 w-3.5" />}
              disabled={exportText === undefined}
              onClick={() => {
                if (exportText !== undefined) void copyWithToast(exportText, t('inspector.copied'));
              }}
            />
            <IconButton
              label={t('inspector.download')}
              icon={<DownloadIcon className="h-3.5 w-3.5" />}
              disabled={exportText === undefined}
              onClick={() => {
                if (exportText === undefined) return;
                try {
                  downloadLocal(
                    exportText,
                    payloadFilename(
                      context.accountId,
                      context.recordType,
                      context.recordId!,
                      format,
                      masked,
                    ),
                    format === 'xml'
                      ? 'application/xml;charset=utf-8'
                      : 'application/json;charset=utf-8',
                  );
                } catch {
                  toast(t('inspector.downloadFailed'));
                }
              }}
            />
          </span>
        </div>
        {masked && <p className="text-xs text-fg-subtlest">{t('inspector.maskNotice')}</p>}
      </div>
      {/* The payload is the main content; "Compare with…" opens the comparison above it. */}
      <div className="flex flex-col gap-2 p-3">
        {comparing && (
          <RecordCompare
            key={JSON.stringify([
              'compare',
              adapter.kind,
              context.accountId,
              context.recordType,
              context.recordId,
              context.url,
            ])}
            adapter={adapter}
            context={context}
            active={state.data?.json}
            masked={masked}
          />
        )}
        {state.status === 'loading' && <Skeleton variant="rows" label={t('app.loading')} />}
        {state.status === 'error' && (
          <ErrorPanel error={state.error} onRetry={() => state.reload(true)} />
        )}
        {state.status === 'success' &&
          (tree ? (
            <div
              role="region"
              aria-label={t(format === 'xml' ? 'inspector.xmlPayload' : 'inspector.jsonPayload')}
              className="font-mono text-xs wrap-anywhere"
            >
              <PayloadBranch
                key={`${format}:${search}`}
                node={tree}
                depth={0}
                query={search}
                wrappers={wrapperChain(tree)}
              />
            </div>
          ) : (
            <p className="text-xs text-fg-muted">{t('inspector.noMatches')}</p>
          ))}
      </div>
    </section>
  );
}

type ViewNode = { label: string; children?: ViewNode[]; closing?: string };
const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function xmlTree(node: RecordPayloadNode): ViewNode {
  const attrs = Object.entries(node.attributes)
    .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
    .join('');
  const opening = `<${node.name}${attrs}>`;
  const closing = `</${node.name}>`;
  if (node.content.every((part) => typeof part === 'string'))
    return { label: `${opening}${escapeXml(node.content.join(''))}${closing}` };
  return {
    label: opening,
    closing,
    children: node.content.map((part) =>
      typeof part === 'string' ? { label: escapeXml(part) } : xmlTree(part),
    ),
  };
}

function jsonTree(value: unknown, key?: string): ViewNode {
  const prefix = key === undefined ? '' : `${JSON.stringify(key)}: `;
  if (typeof value !== 'object' || value === null) return { label: prefix + JSON.stringify(value) };
  const array = Array.isArray(value);
  const children = Object.entries(value).map(([name, part]) =>
    jsonTree(part, array ? undefined : name),
  );
  for (const child of children.slice(0, -1)) {
    if (child.closing) child.closing += ',';
    else child.label += ',';
  }
  const start = array ? '[' : '{';
  const end = array ? ']' : '}';
  return children.length
    ? { label: prefix + start, closing: end, children }
    : { label: prefix + start + end };
}

function filterTree(node: ViewNode, search: string): ViewNode | undefined {
  if (!search || node.label.toLowerCase().includes(search)) return node;
  const children = node.children?.flatMap((child) => {
    const match = filterTree(child, search);
    return match ? [match] : [];
  });
  return children?.length ? { ...node, children } : undefined;
}

/**
 * Response wrappers (for example `nsResponse` → `record`) hold one branch each. They open by
 * default, so the tree starts at the record fields instead of four levels up.
 */
function wrapperChain(root: ViewNode): Set<ViewNode> {
  const chain = new Set<ViewNode>();
  let node: ViewNode | undefined = root;
  while (node?.children) {
    chain.add(node);
    const branches: ViewNode[] = node.children.filter((child) => child.children);
    if (branches.length !== 1 || node.children.length > 4) break;
    node = branches[0];
  }
  return chain;
}

function PayloadBranch({
  node,
  depth,
  query,
  wrappers,
  parentIsWrapper = true,
}: {
  node: ViewNode;
  depth: number;
  query: string;
  wrappers: Set<ViewNode>;
  parentIsWrapper?: boolean;
}) {
  const isWrapper = wrappers.has(node);
  const [open, setOpen] = useState(!!query.trim() || isWrapper || parentIsWrapper || depth < 1);
  if (!node.children)
    return (
      <pre className="whitespace-pre-wrap py-0.5 pl-4">
        <SearchHighlight text={node.label} query={query} />
      </pre>
    );
  // Borderless DevTools-style tree: a chevron row and an indentation guide per level.
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer rounded-xs py-0.5 pl-1 marker:text-fg-subtlest hover:bg-muted">
        <SearchHighlight text={node.label} query={query} />
      </summary>
      {open && (
        <div className="ml-1.5 flex flex-col border-l border-line pl-2">
          {node.children.map((child, index) => (
            <PayloadBranch
              key={index}
              node={child}
              depth={depth + 1}
              query={query}
              wrappers={wrappers}
              parentIsWrapper={isWrapper}
            />
          ))}
          <pre className="whitespace-pre-wrap py-0.5 -ml-2">{node.closing}</pre>
        </div>
      )}
    </details>
  );
}
