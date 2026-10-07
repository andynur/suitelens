import { splitFencedBlocks } from '../guard/AiResponse';
import type { SchemaTable } from '../prompts/suiteql';

/**
 * Post-generation check of AI-written SuiteQL against the partial metadata index (F-5.7).
 *
 * Limitations (by design, explained in the UI):
 * - The index is partial, so an identifier missing from it is "not in the index", not invalid.
 * - This is a lightweight token scanner, not a SQL parser. It resolves tables after FROM/JOIN
 *   (with aliases), `alias.column` references and unqualified columns; it cannot type-check
 *   expressions, and columns of tables that are not in the index are not checked.
 * - Implicit column aliases (without AS) can be reported as unknown columns.
 */

export type SqlIssue =
  | { kind: 'notSelect' }
  | { kind: 'multipleStatements' }
  | { kind: 'unknownTable'; table: string }
  | { kind: 'unknownColumn'; table?: string; column: string }
  | { kind: 'unknownAlias'; alias: string; column: string };

export type SqlValidation = {
  issues: SqlIssue[];
  /** Tables referenced after FROM/JOIN (lower case, de-duplicated). */
  tables: string[];
};

/** Fence languages treated as SuiteQL (an untagged fence counts too). */
export const isSqlLang = (lang: string) => ['', 'sql', 'suiteql'].includes(lang.toLowerCase());

/** All ```sql (or untagged) fenced blocks in an AI answer, in order. */
export function extractSqlBlocks(text: string): string[] {
  return splitFencedBlocks(text).flatMap((block) =>
    block.type === 'code' && isSqlLang(block.lang) && block.code.trim() ? [block.code.trim()] : [],
  );
}

/** The first SQL block of an answer, if any. */
export const extractSql = (text: string) => extractSqlBlocks(text)[0];

type Token =
  | { type: 'word'; value: string }
  | { type: 'punct'; value: string }
  | { type: 'other'; value: string };

/** Tokenizes SQL, dropping comments, string literals, quoted identifiers and numbers. */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i]!;
    if (/\s/.test(ch)) i++;
    else if (sql.startsWith('--', i)) {
      const end = sql.indexOf('\n', i);
      i = end === -1 ? sql.length : end + 1;
    } else if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch && sql[j + 1] === ch) j += 2;
        else if (sql[j] === ch) break;
        else j++;
      }
      tokens.push({ type: 'other', value: ch === "'" ? 'string' : 'quoted' });
      i = j + 1;
    } else if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_$#]*/.exec(sql.slice(i))![0];
      tokens.push({ type: 'word', value: match.toLowerCase() });
      i += match.length;
    } else if (/[0-9]/.test(ch)) {
      const match = /^[0-9][0-9.eE]*/.exec(sql.slice(i))![0];
      tokens.push({ type: 'other', value: 'number' });
      i += match.length;
    } else {
      tokens.push({ type: 'punct', value: ch });
      i++;
    }
  }
  return tokens;
}

/** SQL / Oracle keywords and pseudo-columns that are never table columns. */
const KEYWORDS = new Set(
  (
    'select from where and or not in is null like between case when then else end as on join ' +
    'inner left right full outer cross natural using group by order having asc desc distinct unique ' +
    'union all intersect minus except exists with fetch first next rows row only offset nulls last ' +
    'rownum level sysdate systimestamp current_date current_timestamp true false any some escape ' +
    'interval day month year hour minute second date timestamp over partition prior connect start ' +
    'within keep dense_rank rank lateral'
  ).split(' '),
);

const CLAUSE_END = new Set([
  'where',
  'group',
  'order',
  'having',
  'union',
  'intersect',
  'minus',
  'except',
  'fetch',
  'offset',
  'on',
  'using',
  'join',
  'inner',
  'left',
  'right',
  'full',
  'cross',
  'natural',
  'connect',
  'start',
]);

type Source = { kind: 'table'; name: string } | { kind: 'derived' };

/**
 * Validates one SQL text against the index. `tables` is the partial index (or the built-in
 * list); identifiers are compared case-insensitively.
 */
export function validateSuiteQL(sql: string, index: SchemaTable[]): SqlValidation {
  const issues: SqlIssue[] = [];
  const known = new Map(
    index.map((table) => [
      table.name.toLowerCase(),
      new Set(table.columns.map((column) => column.toLowerCase())),
    ]),
  );
  const tokens = tokenize(sql);
  const is = (i: number, value: string) => tokens[i]?.value === value;
  const isWord = (i: number) => tokens[i]?.type === 'word';

  // Statement shape: one SELECT (or WITH … SELECT).
  const statements = tokens.reduce(
    (parts, token) => {
      if (token.type === 'punct' && token.value === ';') parts.push([]);
      else parts[parts.length - 1]!.push(token);
      return parts;
    },
    [[]] as Token[][],
  );
  if (statements.filter((part) => part.length).length > 1)
    issues.push({ kind: 'multipleStatements' });
  const first = tokens.find((token) => token.type === 'word' || token.value === '(');
  if (!first || (first.value !== 'select' && first.value !== 'with' && first.value !== '('))
    issues.push({ kind: 'notSelect' });

  // Matching parentheses, to skip derived tables.
  const closing = new Map<number, number>();
  const stack: number[] = [];
  tokens.forEach((token, i) => {
    if (token.value === '(' && token.type === 'punct') stack.push(i);
    if (token.value === ')' && token.type === 'punct') {
      const open = stack.pop();
      if (open !== undefined) closing.set(open, i);
    }
  });

  const aliases = new Map<string, Source>();
  const tableNames: string[] = [];
  const definitions = new Set<number>();
  const ctes = new Set<string>();
  const selectAliases = new Set<string>();

  // CTE names: WITH name AS ( … ), name AS ( … )
  tokens.forEach((token, i) => {
    if (
      token.type === 'word' &&
      is(i + 1, 'as') &&
      is(i + 2, '(') &&
      (is(i - 1, 'with') || is(i - 1, ','))
    ) {
      ctes.add(token.value);
      aliases.set(token.value, { kind: 'derived' });
      definitions.add(i);
    }
  });

  const readAlias = (i: number, source: Source) => {
    let j = i;
    if (is(j, 'as')) j++;
    if (isWord(j) && !KEYWORDS.has(tokens[j]!.value) && !CLAUSE_END.has(tokens[j]!.value)) {
      aliases.set(tokens[j]!.value, source);
      definitions.add(j);
      return j + 1;
    }
    return i;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'word' || (token.value !== 'from' && token.value !== 'join')) continue;
    let j = i + 1;
    for (;;) {
      if (is(j, '(')) {
        const end = closing.get(j);
        if (end === undefined) break;
        j = readAlias(end + 1, { kind: 'derived' });
      } else if (isWord(j) && !KEYWORDS.has(tokens[j]!.value)) {
        // `EXTRACT(YEAR FROM t.trandate)` and similar: FROM followed by a qualified name.
        if (is(j + 1, '.') || is(j + 1, '(')) break;
        const name = tokens[j]!.value;
        definitions.add(j);
        const source: Source = ctes.has(name) ? { kind: 'derived' } : { kind: 'table', name };
        if (source.kind === 'table') tableNames.push(name);
        aliases.set(name, source);
        j = readAlias(j + 1, source);
      } else break;
      if (token.value === 'from' && is(j, ',')) j++;
      else break;
    }
  }

  // Select-list aliases (`expr AS name`), usable in ORDER BY and outer queries.
  tokens.forEach((token, i) => {
    if (token.value === 'as' && isWord(i + 1) && !is(i + 2, '(')) {
      selectAliases.add(tokens[i + 1]!.value);
      definitions.add(i + 1);
    }
  });

  const tables = [...new Set(tableNames)];
  for (const table of tables) if (!known.has(table)) issues.push({ kind: 'unknownTable', table });

  const seen = new Set<string>();
  const report = (issue: SqlIssue, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    issues.push(issue);
  };
  const realTables = tables.filter((table) => known.has(table));
  const allKnown = realTables.length === tables.length;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type !== 'word' || definitions.has(i) || KEYWORDS.has(token.value)) continue;
    if (is(i - 1, '.') || is(i - 1, ':')) continue; // second half of a.b, or a bind variable
    if (is(i + 1, '(')) continue; // function call
    if (is(i + 1, '.')) {
      // qualifier.column or package.function (BUILTIN.DF)
      if (!isWord(i + 2) || is(i + 3, '(')) continue;
      const column = tokens[i + 2]!.value;
      const source = aliases.get(token.value);
      if (!source) {
        report(
          { kind: 'unknownAlias', alias: token.value, column },
          `alias:${token.value}.${column}`,
        );
        continue;
      }
      if (source.kind !== 'table') continue;
      const columns = known.get(source.name);
      if (columns && !columns.has(column))
        report(
          { kind: 'unknownColumn', table: source.name, column },
          `col:${source.name}.${column}`,
        );
      continue;
    }
    // Unqualified identifier: a column of some referenced table, an alias, or unknown.
    const value = token.value;
    if (aliases.has(value) || selectAliases.has(value) || ctes.has(value)) continue;
    if (realTables.some((table) => known.get(table)!.has(value))) continue;
    if (!allKnown || !tables.length) continue; // cannot decide without full column lists
    report(
      { kind: 'unknownColumn', table: tables.length === 1 ? tables[0] : undefined, column: value },
      `col:${tables.length === 1 ? tables[0] : ''}.${value}`,
    );
  }

  return { issues, tables };
}
