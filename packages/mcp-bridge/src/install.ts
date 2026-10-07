import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, chmod, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { NATIVE_HOST } from './protocol.js';
import { IPC_DIR, privateDirectory } from './ipc.js';

const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
export function manifestDirectory(platform = process.platform, home = homedir()) {
  if (platform === 'darwin')
    return join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts');
  if (platform === 'linux') return join(home, '.config/google-chrome/NativeMessagingHosts');
  if (platform === 'win32') return IPC_DIR;
  throw new Error('Supported platforms: macOS, Linux, Windows.');
}
export async function install(extensionId: string, remove = false) {
  if (!/^[a-p]{32}$/.test(extensionId))
    throw new Error('Pass the 32-letter Chrome extension ID from chrome://extensions.');
  await privateDirectory();
  const directory = manifestDirectory();
  const manifest = join(directory, `${NATIVE_HOST}.json`);
  const wrapper = join(IPC_DIR, process.platform === 'win32' ? 'host.cmd' : 'host');
  const registry = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST}`;
  if (remove) {
    if (process.platform === 'win32')
      execFileSync('reg.exe', ['delete', registry, '/f'], { stdio: 'ignore' });
    await Promise.all([unlink(manifest).catch(() => {}), unlink(wrapper).catch(() => {})]);
    return;
  }
  const cli = join(dirname(fileURLToPath(import.meta.url)), 'cli.js');
  if (process.platform === 'win32') {
    if (/[\r\n%&|<>^]/.test(process.execPath + cli)) throw new Error('Unsafe launcher path');
    // Restrict inherited permissions on the rendezvous directory to this Windows user.
    const user = execFileSync('whoami.exe', [], { encoding: 'utf8' }).trim();
    execFileSync('icacls.exe', [IPC_DIR, '/inheritance:r', '/grant:r', `${user}:(OI)(CI)F`], {
      stdio: 'ignore',
    });
    await writeFile(wrapper, `@echo off\r\n"${process.execPath}" "${cli}" native\r\n`);
  } else {
    await writeFile(wrapper, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(cli)} native\n`, {
      mode: 0o700,
    });
    await chmod(wrapper, 0o700);
  }
  await mkdir(directory, { recursive: true });
  await writeFile(
    manifest,
    JSON.stringify(
      {
        name: NATIVE_HOST,
        description: 'SuiteLens for NetSuite local read-only bridge',
        path: wrapper,
        type: 'stdio',
        allowed_origins: [`chrome-extension://${extensionId}/`],
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  if (process.platform === 'win32')
    execFileSync('reg.exe', ['add', registry, '/ve', '/t', 'REG_SZ', '/d', manifest, '/f'], {
      stdio: 'ignore',
    });
  process.stderr.write(`Installed Native Messaging manifest: ${manifest}\n`);
}
