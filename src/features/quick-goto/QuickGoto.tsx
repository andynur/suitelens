import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { browser } from 'wxt/browser';
import { RECORD_TYPE_MAP } from '../../netsuite/context/recordTypeMap';
import { buildRecordUrl, type GoToTarget } from '../../netsuite/urls';
import { t } from '../../shared/i18n';
import { getGotoHistory, pushGotoHistory, type GotoEntry } from '../../shared/storage/gotoHistory';
import { Button } from '../../shared/ui/Button';

const TRANSACTION = '__transaction';
const CUSTOM_RECORD = '__customrecord';

function toTarget(type: string, id: string, customRecordTypeId: string): GoToTarget {
  if (type === TRANSACTION) return { kind: 'transaction', id };
  if (type === CUSTOM_RECORD) return { kind: 'customrecord', customRecordTypeId, id };
  return { kind: 'mapped', recordType: type, id };
}

function entryLabel(e: GotoEntry): string {
  if (e.kind === 'transaction') return `${t('goto.recordType.transaction')} #${e.id}`;
  if (e.kind === 'customrecord') return `customrecord ${e.customRecordTypeId ?? ''} #${e.id}`;
  return `${e.recordType ?? ''} #${e.id}`;
}

/** Quick Go-to (F-1.21): open a record by type + internal ID; last 10 per account. */
export function QuickGoto({
  accountId,
  defaultRecordType,
  autoFocus,
}: {
  accountId: string;
  defaultRecordType?: string;
  autoFocus?: boolean;
}) {
  const formId = useId();
  const idInput = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(
    defaultRecordType && RECORD_TYPE_MAP.some((m) => m.recordType === defaultRecordType)
      ? defaultRecordType
      : 'salesorder',
  );
  const [id, setId] = useState('');
  const [customRecordTypeId, setCustomRecordTypeId] = useState('');
  const [newTab, setNewTab] = useState(false);
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<GotoEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getGotoHistory(accountId).then((h) => {
      if (!cancelled) setHistory(h);
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    if (autoFocus) idInput.current?.focus();
  }, [autoFocus]);

  const open = async (target: GoToTarget, inNewTab: boolean) => {
    const url = buildRecordUrl(accountId, target);
    if (!url) {
      setError(t('goto.invalid'));
      return;
    }
    setError(undefined);
    setHistory(await pushGotoHistory(accountId, target));
    if (inNewTab) {
      await browser.tabs.create({ url });
    } else {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id !== undefined) await browser.tabs.update(tab.id, { url });
      else await browser.tabs.create({ url });
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void open(toTarget(type, id.trim(), customRecordTypeId.trim()), newTab);
  };

  const inputClass =
    'w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg focus:outline-2 focus:outline-accent';

  return (
    <form
      onSubmit={onSubmit}
      aria-labelledby={`${formId}-title`}
      className="flex flex-col gap-2 p-3"
    >
      <h2 id={`${formId}-title`} className="text-xs font-semibold text-fg">
        {t('goto.title')}
      </h2>
      <label className="text-[11px] text-fg-muted">
        {t('goto.recordType')}
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
          {RECORD_TYPE_MAP.map((m) => (
            <option key={m.recordType} value={m.recordType}>
              {m.label} ({m.recordType})
            </option>
          ))}
          <option value={TRANSACTION}>{t('goto.recordType.transaction')}</option>
          <option value={CUSTOM_RECORD}>{t('goto.recordType.customrecord')}</option>
        </select>
      </label>
      {type === CUSTOM_RECORD && (
        <label className="text-[11px] text-fg-muted">
          {t('goto.customRecordTypeId')}
          <input
            inputMode="numeric"
            value={customRecordTypeId}
            onChange={(e) => setCustomRecordTypeId(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <label className="text-[11px] text-fg-muted">
        {t('goto.internalId')}
        <input
          ref={idInput}
          inputMode="numeric"
          value={id}
          onChange={(e) => setId(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-[11px] text-fg">
        <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} />
        {t('goto.newTab')}
      </label>
      {error && (
        <p role="alert" className="text-[11px] text-danger">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary">
          {t('goto.open')}
        </Button>
      </div>
      {history.length > 0 && (
        <div>
          <h3 className="mb-1 text-[11px] font-semibold text-fg-muted">{t('goto.recent')}</h3>
          <ul className="flex flex-col gap-0.5">
            {history.map((h) => (
              <li key={`${h.kind}-${h.recordType ?? h.customRecordTypeId ?? ''}-${h.id}`}>
                <button
                  type="button"
                  className="font-mono text-[11px] text-accent hover:underline"
                  onClick={() =>
                    void open(
                      h.kind === 'mapped'
                        ? { kind: 'mapped', recordType: h.recordType ?? '', id: h.id }
                        : h.kind === 'customrecord'
                          ? {
                              kind: 'customrecord',
                              customRecordTypeId: h.customRecordTypeId ?? '',
                              id: h.id,
                            }
                          : { kind: 'transaction', id: h.id },
                      newTab,
                    )
                  }
                >
                  {entryLabel(h)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
