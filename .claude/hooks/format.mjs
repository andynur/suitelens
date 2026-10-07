// PostToolUse hook: run Prettier on the file an agent just wrote, so `pnpm lint`
// never fails on formatting and the agent does not spend a turn fixing it.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const prettier = path.join(root, 'node_modules', '.bin', 'prettier');

let input = '';
for await (const chunk of process.stdin) input += chunk;

let file;
try {
  file = JSON.parse(input).tool_input?.file_path;
} catch {
  process.exit(0);
}

const inRepo = typeof file === 'string' && path.resolve(file).startsWith(root + path.sep);
if (!inRepo || !existsSync(prettier)) process.exit(0);

try {
  // --ignore-unknown + .prettierignore skip Markdown and generated files.
  execFileSync(prettier, ['--write', '--ignore-unknown', '--log-level', 'silent', file], {
    cwd: root,
    stdio: 'ignore',
  });
} catch {
  // Syntax errors surface in typecheck/lint; never block the edit here.
}
