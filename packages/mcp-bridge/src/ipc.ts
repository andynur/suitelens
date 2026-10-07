import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, lstat, chmod } from 'node:fs/promises';
export const IPC_DIR = join(homedir(), '.suitelens-mcp');
export const ENDPOINT_FILE = join(IPC_DIR, 'endpoint.json');
/** User-private rendezvous. No NetSuite data or approval is written to disk. */
export async function privateDirectory() {
  await mkdir(IPC_DIR, { recursive: true, mode: 0o700 });
  const stat = await lstat(IPC_DIR);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe IPC directory');
  if (process.platform !== 'win32') {
    if (stat.uid !== process.getuid?.()) throw new Error('Wrong IPC owner');
    await chmod(IPC_DIR, 0o700);
  }
}
