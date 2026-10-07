import { useEffect, useRef, useState } from 'react';
import type { NetSuiteAdapter } from '../../netsuite/adapter/NetSuiteAdapter';
import type { PageContext } from '../../netsuite/types';
import { toSuiteLensError, type SuiteLensErrorShape } from '../../netsuite/errors';
import type { RestletDeployment } from '../../netsuite/queries/restlets';
import {
  validateRestletRequest,
  type RestletRequest,
  type RestletResponse,
} from '../../netsuite/restlets/request';
import { useAccountSettings } from '../../shared/hooks/useAccountSettings';
import { t } from '../../shared/i18n';
import {
  emptyCollection,
  getRestletCollection,
  saveRestletCollection,
  resolveRequestVariables,
  type RestletCollection,
} from '../../shared/storage/restletCollections';
import { Button } from '../../shared/ui/Button';
import { fieldClass } from '../../shared/ui/field';
import { ErrorPanel } from '../../shared/ui/ErrorPanel';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { Spinner } from '../../shared/ui/Spinner';

export function RequestBuilder({
  adapter,
  context,
  deployment,
}: {
  adapter: NetSuiteAdapter;
  context: PageContext;
  deployment: RestletDeployment;
}) {
  const [method, setMethod] = useState<RestletRequest['method']>('GET');
  const [params, setParams] = useState('{}');
  const [headers, setHeaders] = useState('{}');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<'sandbox' | 'production'>(
    context.environment === 'sandbox' ? 'sandbox' : 'production',
  );
  const [variables, setVariables] = useState('{}');
  const [collection, setCollection] = useState<RestletCollection>(emptyCollection);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<SuiteLensErrorShape>();
  const [response, setResponse] = useState<RestletResponse>();
  const [pending, setPending] = useState<RestletRequest>();
  const account = useAccountSettings(context.accountId);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void getRestletCollection(context.accountId)
      .then((data) => {
        if (!alive.current) return;
        setCollection(data);
        setVariables(JSON.stringify(data.presets[preset], null, 2));
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (alive.current) setError(toSuiteLensError(err).toShape());
      });
    return () => {
      alive.current = false;
    };
    // The parent keys this view by account/page/deployment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.accountId]);
  const request = () =>
    validateRestletRequest({
      accountId: context.accountId,
      script: deployment.scriptInternalId,
      deploy: deployment.deploymentInternalId,
      method,
      params: JSON.parse(params),
      headers: JSON.parse(headers),
      body,
      confirmed: false,
    });
  const handleError = (err: unknown) => setError(toSuiteLensError(err).toShape());
  const execute = async (req: RestletRequest) => {
    setPending(undefined);
    setBusy(true);
    setError(undefined);
    setResponse(undefined);
    try {
      const current = await adapter.getPageContext();
      if (current?.accountId !== context.accountId || current.url !== context.url)
        throw new Error('Target changed before execution.');
      if (!alive.current) return;
      const result = await adapter.callRestlet(req);
      if (alive.current) setResponse(result);
    } catch (err) {
      if (alive.current) handleError(err);
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const prepare = () => {
    try {
      const req = resolveRequestVariables(request(), JSON.parse(variables));
      if (req.method === 'GET') void execute(req);
      else setPending(req);
      setError(undefined);
    } catch (err) {
      handleError(err);
    }
  };
  const persist = async (next: RestletCollection) => {
    await saveRestletCollection(context.accountId, next);
    if (alive.current) {
      setCollection(next);
      setError(undefined);
    }
  };
  const blocked =
    method !== 'GET' &&
    (context.environment === 'unknown' ||
      (context.environment !== 'sandbox' && !account.allowProductionWrites));
  let pretty = response?.body;
  try {
    if (pretty) pretty = JSON.stringify(JSON.parse(pretty), null, 2);
  } catch {
    /* Text responses remain text. */
  }
  return (
    <section
      aria-label={t('restlet.builder')}
      className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-xs"
    >
      <h3 className="text-sm font-semibold">{t('restlet.builder')}</h3>
      <p className="font-mono wrap-anywhere">
        {deployment.scriptId} / {deployment.deploymentId}
      </p>
      <label>
        {t('restlet.method')}
        <select
          className={`${fieldClass} w-full`}
          aria-label={t('restlet.method')}
          value={method}
          disabled={busy || !!pending}
          onChange={(e) => setMethod(e.target.value as RestletRequest['method'])}
        >
          {(['GET', 'POST', 'PUT', 'DELETE'] as const).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      {(
        [
          { key: 'restlet.params', value: params, set: setParams },
          { key: 'restlet.headers', value: headers, set: setHeaders },
          { key: 'restlet.body', value: body, set: setBody },
        ] as const
      ).map((field) => (
        <label key={field.key}>
          {t(field.key)}
          <textarea
            className={`${fieldClass} w-full font-mono`}
            rows={field.key === 'restlet.body' ? 6 : 3}
            spellCheck={false}
            disabled={busy || !!pending}
            value={field.value}
            onChange={(e) => field.set(e.target.value)}
            onBlur={() => {
              try {
                if (field.value.trim()) field.set(JSON.stringify(JSON.parse(field.value), null, 2));
              } catch {
                /* Validation happens before dispatch. */
              }
            }}
          />
        </label>
      ))}
      <label>
        {t('restlet.preset')}
        <select
          className={`${fieldClass} w-full`}
          aria-label={t('restlet.preset')}
          value={preset}
          disabled={busy || !!pending}
          onChange={(e) => {
            const next = e.target.value as typeof preset;
            setPreset(next);
            setVariables(JSON.stringify(collection.presets[next], null, 2));
          }}
        >
          <option value="sandbox">{t('env.sandbox')}</option>
          <option value="production">{t('env.production')}</option>
        </select>
      </label>
      <label>
        {t('restlet.variables')}
        <textarea
          rows={3}
          className={`${fieldClass} w-full font-mono`}
          value={variables}
          disabled={busy || !!pending}
          onChange={(e) => setVariables(e.target.value)}
        />
      </label>
      <p className="text-xs text-fg-muted">{t('restlet.variablesHint')}</p>
      <Button
        disabled={!loaded || busy || !!pending}
        onClick={() => {
          try {
            void persist({
              ...collection,
              presets: { ...collection.presets, [preset]: JSON.parse(variables) },
            }).catch(handleError);
          } catch (err) {
            handleError(err);
          }
        }}
      >
        {t('restlet.savePreset')}
      </Button>
      <label>
        {t('restlet.requestName')}
        <input
          className={`${fieldClass} w-full`}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button
        disabled={!loaded || !name.trim() || busy || !!pending}
        onClick={() => {
          try {
            const req = request();
            void persist({
              ...collection,
              requests: [
                ...collection.requests.filter((item) => item.name !== name.trim()),
                { name: name.trim(), request: req },
              ],
            }).catch(handleError);
          } catch (err) {
            handleError(err);
          }
        }}
      >
        {t('restlet.saveRequest')}
      </Button>
      <ul aria-label={t('restlet.collections')} className="flex flex-col gap-1">
        {collection.requests
          .filter(
            (item) =>
              item.request.script === deployment.scriptInternalId &&
              item.request.deploy === deployment.deploymentInternalId,
          )
          .map((item) => (
            <li key={item.name} className="flex gap-1">
              <Button
                disabled={busy || !!pending}
                onClick={() => {
                  setMethod(item.request.method);
                  setParams(JSON.stringify(item.request.params, null, 2));
                  setHeaders(JSON.stringify(item.request.headers, null, 2));
                  setBody(item.request.body);
                  setName(item.name);
                }}
              >
                {t('restlet.loadRequest', { name: item.name })}
              </Button>
              <Button
                disabled={busy || !!pending}
                onClick={() =>
                  void persist({
                    ...collection,
                    requests: collection.requests.filter((entry) => entry.name !== item.name),
                  }).catch(handleError)
                }
              >
                {t('restlet.deleteRequest', { name: item.name })}
              </Button>
            </li>
          ))}
      </ul>
      {blocked && (
        <SectionMessage appearance="warning">{t('restlet.writesBlocked')}</SectionMessage>
      )}
      {pending && (
        <SectionMessage
          appearance="warning"
          role="alertdialog"
          title={t('restlet.confirmTitle')}
          actions={
            <>
              <Button
                variant="danger"
                disabled={blocked}
                onClick={() => void execute({ ...pending, confirmed: true })}
              >
                {t('app.confirm')}
              </Button>
              <Button onClick={() => setPending(undefined)}>{t('app.cancel')}</Button>
            </>
          }
        >
          <p>
            {t('restlet.confirm', {
              method: pending.method,
              script: deployment.scriptId,
              deploy: deployment.deploymentId,
              account: context.accountId,
              environment: t(`env.${context.environment}`),
            })}
          </p>
          {context.environment !== 'sandbox' && <p>{t('restlet.productionWarning')}</p>}
        </SectionMessage>
      )}
      <Button variant="primary" disabled={busy || !!pending || blocked} onClick={prepare}>
        {t('restlet.send')}
      </Button>
      {busy && <Spinner label={t('restlet.sending')} />}
      {error && <ErrorPanel error={error} />}
      {response && (
        <div>
          <p>
            {t('restlet.response', {
              status: response.status,
              ms: Math.round(response.elapsedMs),
              bytes: response.bytes,
            })}
          </p>
          <pre
            aria-label={t('restlet.responseBody')}
            className="mt-2 whitespace-pre-wrap font-mono wrap-anywhere"
          >
            {pretty}
          </pre>
        </div>
      )}
      <p className="text-fg-subtlest">{t('restlet.authNote')}</p>
    </section>
  );
}
