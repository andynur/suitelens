import { createConnection, type Socket } from 'node:net';
import { readFile } from 'node:fs/promises';
import { ENDPOINT_FILE, privateDirectory } from './ipc.js';
import { encodeFrame, frameDecoder } from './framing.js';
import { NativeRequestSchema, NativeResponseSchema } from './protocol.js';
import { z } from 'zod';

/** Chrome launches this process. It relays validated frames; it never accesses NetSuite. */
export async function nativeHost() {
  await privateDirectory();
  let socket: Socket | undefined;
  let stopped = false;
  // Replies belong to the current IPC peer only. A late browser read from a disconnected
  // client must never be relayed to the next client when the host reconnects.
  const pending = new Set<string>();
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    if (stopped) return;
    try {
      const raw: unknown = JSON.parse(await readFile(ENDPOINT_FILE, 'utf8'));
      const { endpoint } = z
        .object({ endpoint: z.string().min(1).max(500), pid: z.number().int().positive() })
        .parse(raw);
      // Only local-domain IPC. Never accept TCP addresses from disk.
      if (
        process.platform === 'win32'
          ? !endpoint.startsWith('\\\\.\\pipe\\suitelens-')
          : !endpoint.endsWith('/.suitelens-mcp/bridge.sock')
      )
        throw new Error('Invalid endpoint');
      const peer = createConnection(endpoint);
      socket = peer;
      const decode = frameDecoder((value) => {
        const parsed = NativeRequestSchema.safeParse(value);
        if (!parsed.success) {
          peer.destroy();
          return;
        }
        if (pending.size >= 4 || pending.has(parsed.data.id)) {
          peer.write(
            encodeFrame({ type: 'response', id: parsed.data.id, ok: false, error: 'BUSY' }),
          );
          return;
        }
        pending.add(parsed.data.id);
        process.stdout.write(encodeFrame(parsed.data));
      });
      peer.on('data', (data) => {
        try {
          decode(data);
        } catch {
          peer.destroy();
        }
      });
      peer.on('error', () => peer.destroy());
      peer.on('close', () => {
        socket = undefined;
        pending.clear();
        if (!stopped) retry = setTimeout(() => void connect(), 1000);
      });
    } catch {
      if (!stopped) retry = setTimeout(() => void connect(), 1000);
    }
  };
  const decode = frameDecoder((raw) => {
    const parsed = NativeResponseSchema.safeParse(raw);
    if (!parsed.success) throw new Error('Invalid browser response');
    if (!pending.delete(parsed.data.id)) return;
    socket?.write(encodeFrame(parsed.data));
  });
  process.stdin.on('data', (chunk: Buffer) => {
    try {
      decode(chunk);
    } catch {
      process.stdin.destroy();
    }
  });
  process.stdin.on('end', () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    socket?.destroy();
  });
  await connect();
}
