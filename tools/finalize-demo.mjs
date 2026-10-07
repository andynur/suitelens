import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const directory = resolve(import.meta.dirname, '../artifacts/launch');
// A true recorded fixture-browser walkthrough, trimmed to the required 75-second duration.
execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-sseof',
    '-75',
    '-i',
    resolve(directory, 'demo-raw.webm'),
    '-t',
    '75',
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    '800k',
    '-an',
    resolve(directory, 'demo-75s.webm'),
  ],
  { stdio: 'inherit' },
);
process.stdout.write(
  'Fixture store media: artifacts/launch/ (five screenshots and demo-75s.webm). Review before publication.\n',
);
