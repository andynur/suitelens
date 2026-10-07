import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { McpStateSchema, McpControlResponseSchema } from '../../netsuite/bridge/protocol';
import { type McpState, type McpControlSchema } from '../../../packages/mcp-bridge/src/protocol';
import type { z } from 'zod';
import { getTargetTab } from '../../shared/messaging';
import { t } from '../../shared/i18n';
import { Button } from '../../shared/ui/Button';
import { SectionMessage } from '../../shared/ui/SectionMessage';
import { MCP_STATE_KEY } from './state';
import { REPOSITORY_URL } from '../../shared/constants';

export function McpSettings() {
  const [state, setState] = useState<McpState>({ connected: false, sessions: [], log: [] });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const load = () =>
      void browser.storage.session.get(MCP_STATE_KEY).then((stored) => {
        const parsed = McpStateSchema.safeParse(stored[MCP_STATE_KEY]);
        if (parsed.success) setState(parsed.data);
        else setState({ connected: false, sessions: [], log: [] });
      });
    load();
    const listener = (changes: Record<string, unknown>, area: string) => {
      if (area === 'session' && MCP_STATE_KEY in changes) load();
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);
  const control = async (message: z.infer<typeof McpControlSchema>) => {
    setFailed(false);
    setBusy(true);
    try {
      if (!McpControlResponseSchema.parse(await browser.runtime.sendMessage(message)))
        setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 text-xs">
      <SectionMessage appearance="warning">
        <p>{t('mcp.disclosure')}</p>
      </SectionMessage>
      <p>
        {state.connected
          ? t('mcp.connected', {
              accountId: state.accountId ?? '',
              environment: state.environment ?? '',
            })
          : t('mcp.notConnected')}
      </p>
      <a
        className="text-accent hover:underline"
        href={`${REPOSITORY_URL}/blob/main/docs/mcp-setup.md`}
        target="_blank"
        rel="noreferrer noopener"
      >
        {t('mcp.setup')} ↗
      </a>
      <div className="flex gap-2">
        <Button
          disabled={busy}
          onClick={() => {
            // Optional permission must be requested synchronously from this user gesture.
            void browser.permissions
              .request({ permissions: ['nativeMessaging'] })
              .then(async (allowed) => {
                if (!allowed) {
                  setFailed(true);
                  return;
                }
                const target = await getTargetTab();
                if (!target) {
                  setFailed(true);
                  return;
                }
                await control({ type: 'suitelens:mcp', action: 'connect', tabId: target.id });
              })
              .catch(() => setFailed(true));
          }}
        >
          {t('mcp.connect')}
        </Button>
        <Button
          disabled={busy || !state.connected}
          onClick={() => void control({ type: 'suitelens:mcp', action: 'disconnect' })}
        >
          {t('mcp.disconnect')}
        </Button>
      </div>
      {(failed || state.error) && (
        <SectionMessage appearance="error">{t('mcp.failed')}</SectionMessage>
      )}
      {state.sessions.map((session) => (
        <SectionMessage
          key={session.id}
          appearance={session.status === 'pending' ? 'warning' : 'information'}
        >
          <p>
            {t('mcp.pending', {
              agent: session.agent,
              accountId: state.accountId ?? '',
              environment: state.environment ?? '',
            })}
          </p>
          {session.status === 'approved' && session.expiresAt > now ? (
            <p>{t('mcp.approved', { time: new Date(session.expiresAt).toLocaleTimeString() })}</p>
          ) : (
            session.status !== 'pending' && <p>{t('mcp.denied')}</p>
          )}
          <div className="mt-2 flex gap-2">
            {session.status === 'pending' && (
              <Button
                disabled={busy}
                onClick={() =>
                  void control({ type: 'suitelens:mcp', action: 'approve', sessionId: session.id })
                }
              >
                {t('mcp.approve')}
              </Button>
            )}
            <Button
              disabled={busy}
              onClick={() =>
                void control({ type: 'suitelens:mcp', action: 'deny', sessionId: session.id })
              }
            >
              {t('mcp.deny')}
            </Button>
          </div>
        </SectionMessage>
      ))}
      <h3 className="font-semibold">{t('mcp.log')}</h3>
      <Button
        disabled={busy}
        onClick={() => void control({ type: 'suitelens:mcp', action: 'clearLog' })}
      >
        {t('mcp.clearLog')}
      </Button>
      {!state.log.length && <p>{t('mcp.emptyLog')}</p>}
      <ul className="space-y-1 font-mono">
        {state.log
          .slice()
          .reverse()
          .map((entry, index) => (
            <li key={index}>
              {new Date(entry.time).toLocaleTimeString()} · {entry.tool} · {entry.accountId} ·{' '}
              {entry.rows} · {entry.outcome}
            </li>
          ))}
      </ul>
    </div>
  );
}
