import { browser, type Browser } from 'wxt/browser';
import {
  AI_PORT_NAME,
  AiPortClientMessageSchema,
  AiPortServerMessageSchema,
  type AiPortServerMessage,
} from '../../netsuite/bridge/protocol';
import { SuiteLensError } from '../../netsuite/errors';
import { effectiveFeatures } from '../../shared/features';
import { createLogger } from '../../shared/logger';
import { getAiKeyInfo, getUnlockedAiKey } from '../../shared/storage/aiSecret';
import { getSettings } from '../../shared/storage/settings';
import { resolveAiProvider } from './providers';
import { AiRequestSchema, type AiProviderId, type AiRequest } from './types';
import { addAiUsage, assertWithinDailyLimit } from './usage';

const log = createLogger('ai');

type Port = Browser.runtime.Port;
type Sender = Browser.runtime.MessageSender;

/**
 * Background side of AI Assist (ADR 0041, F-5.3, NF-5.2). Every provider call runs here; the
 * side panel talks to it through one `AI_PORT_NAME` port per request. Provider, model, key and
 * limits come from Settings and secure storage, never from the request.
 */
export function registerAiPort(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== AI_PORT_NAME) return;
    if (!isExtensionPage(port.sender)) {
      log.warn('rejected AI port from an untrusted sender');
      port.disconnect();
      return;
    }
    handleAiPort(port);
  });
}

/**
 * Only this extension's own pages (side panel, or full-page Logs/Console opened as a tab);
 * never content scripts (their URL is the NetSuite page) or other extensions. Same rule as
 * the forward handler in `src/entrypoints/background.ts`.
 */
function isExtensionPage(sender: Sender | undefined): boolean {
  if (!sender || sender.id !== browser.runtime.id) return false;
  return sender.url?.startsWith(browser.runtime.getURL('/')) === true;
}

export function handleAiPort(port: Port): void {
  const controller = new AbortController();
  let started = false;
  let disconnected = false;

  const post = (message: AiPortServerMessage) => {
    if (disconnected) return;
    const parsed = AiPortServerMessageSchema.safeParse(message);
    if (!parsed.success) {
      log.error('invalid AI port message', { type: message.type });
      return;
    }
    try {
      port.postMessage(parsed.data);
    } catch {
      disconnected = true;
      controller.abort();
    }
  };

  port.onDisconnect.addListener(() => {
    disconnected = true;
    controller.abort();
  });

  port.onMessage.addListener((raw: unknown) => {
    const parsed = AiPortClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      log.warn('ignored invalid AI port message');
      return;
    }
    if (parsed.data.type === 'cancel') {
      controller.abort();
      return;
    }
    if (started) return;
    started = true;
    void runRequest(parsed.data.request, controller.signal, post);
  });
}

async function runRequest(
  rawRequest: AiRequest,
  signal: AbortSignal,
  post: (message: AiPortServerMessage) => void,
): Promise<void> {
  const startedAt = Date.now();
  let feature: string = 'unknown';
  let model = '';
  try {
    const request = AiRequestSchema.parse(rawRequest);
    feature = request.feature;
    const settings = await getSettings();
    if (!effectiveFeatures(settings).aiAssist) {
      throw new SuiteLensError('UNSUPPORTED', 'AI Assist is turned off in Settings.');
    }
    model = settings.ai.model;
    const provider = await resolveAiProvider(settings);
    const apiKey = provider.requiresKey ? await requireKey(settings.ai.provider) : undefined;
    await assertWithinDailyLimit(settings.ai);
    if (signal.aborted) throw cancelled();

    log.debug('AI request started', { feature, provider: provider.kind, model });
    const result = await provider.stream({
      feature: request.feature,
      apiKey,
      model,
      maxTokens: settings.ai.maxTokensPerRequest,
      system: request.system,
      messages: request.messages,
      signal,
      onDelta: (text) => {
        if (text) post({ type: 'delta', text });
      },
    });

    try {
      await addAiUsage(result.usage);
    } catch (err) {
      log.warn('could not record AI usage', { err: String(err) });
    }
    log.debug('AI request finished', {
      feature,
      model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      stopReason: result.stopReason,
      ms: Date.now() - startedAt,
    });

    if (result.stopReason === 'refusal') {
      throw new SuiteLensError(
        'AI_PROVIDER_ERROR',
        'The AI model declined this request. Rephrase it or remove content from the preview.',
        'stop_reason: refusal',
      );
    }
    post({
      type: 'done',
      usage: result.usage,
      ...(result.stopReason ? { stopReason: result.stopReason } : {}),
    });
  } catch (err) {
    const error = signal.aborted ? cancelled() : safeError(err);
    log.debug('AI request failed', { feature, model, code: error.code });
    post({ type: 'error', error: error.toShape() });
  }
}

async function requireKey(provider: AiProviderId): Promise<string> {
  const key = await getUnlockedAiKey(provider);
  if (key) return key;
  const info = await getAiKeyInfo(provider);
  if (info.stored === 'none') {
    throw new SuiteLensError(
      'AI_NOT_CONFIGURED',
      'Add an AI API key in Settings to use AI Assist.',
    );
  }
  throw new SuiteLensError('AI_LOCKED', 'Unlock your AI API key in Settings to use AI Assist.');
}

function cancelled(): SuiteLensError {
  return new SuiteLensError('CANCELLED', 'The AI request was cancelled.');
}

/** Unexpected errors keep their code but never forward a raw message that could echo payloads. */
function safeError(err: unknown): SuiteLensError {
  if (err instanceof SuiteLensError) return err;
  return new SuiteLensError(
    'AI_PROVIDER_ERROR',
    'The AI request failed.',
    err instanceof Error ? err.name : undefined,
  );
}
