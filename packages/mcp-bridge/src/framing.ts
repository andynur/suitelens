import { MAX_FRAME_BYTES } from './protocol.js';

export function encodeFrame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  if (body.length > MAX_FRAME_BYTES) throw new Error('Frame too large');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length);
  return Buffer.concat([header, body]);
}
/** Bounded incremental decoder for Chrome Native Messaging and local IPC. */
export function frameDecoder(onValue: (value: unknown) => void) {
  let buffer = Buffer.alloc(0);
  return (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const size = buffer.readUInt32LE(0);
      if (size === 0 || size > MAX_FRAME_BYTES) throw new Error('Invalid frame length');
      if (buffer.length < size + 4) return;
      const body = buffer.subarray(4, size + 4);
      buffer = buffer.subarray(size + 4);
      onValue(JSON.parse(body.toString('utf8')) as unknown);
    }
  };
}
