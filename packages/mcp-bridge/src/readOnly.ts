/** Conservative single-read guard, not a SQL parser. N/query remains the read-only executor. */
export function readOnlyStatement(sql: string): string | undefined {
  const tokens: string[] = [];
  let ended = false;
  let statementEnd = sql.length;
  for (let i = 0; i < sql.length;) {
    const rest = sql.slice(i);
    const whitespace = /^\s+/.exec(rest);
    if (whitespace) {
      i += whitespace[0].length;
      continue;
    }
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i + 2);
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) return undefined;
      i = end + 2;
      continue;
    }
    if (ended) return undefined;
    const char = sql[i]!;
    if (char === ';') {
      statementEnd = i;
      ended = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"') {
      i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i++] === char) {
          if (sql[i] === char) i++;
          else {
            closed = true;
            break;
          }
        }
      }
      if (!closed) return undefined;
      continue;
    }
    const word = /^[a-z_][a-z0-9_$#]*/i.exec(rest);
    if (word) {
      tokens.push(word[0].toUpperCase());
      i += word[0].length;
    } else i++;
  }
  const valid =
    /^(SELECT|WITH)$/.test(tokens[0] ?? '') &&
    tokens.includes('SELECT') &&
    !tokens.some((token) =>
      /^(INSERT|UPDATE|DELETE|MERGE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|BEGIN|CALL|COMMIT|ROLLBACK|INTO)$/.test(
        token,
      ),
    );
  return valid ? sql.slice(0, statementEnd).trim() : undefined;
}
