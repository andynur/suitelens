import { readFixture } from '../../test/fixtures';
import { DEPENDENCY_LIMITS, scanScriptDependencies } from './dependencies';
import { REFERENCE_LIMITS } from './references';

describe('static script dependencies', () => {
  it('finds the fixture module with one-based locations', () => {
    expect(scanScriptDependencies(readFixture('impact-analysis/user-event.js'))).toEqual({
      status: 'checked',
      declarations: [{ line: 2, modules: [{ id: 'N/record', line: 2, column: 9 }] }],
    });
  });
  it('supports multiline named modules, decoded escapes and duplicate imports', () => {
    const result = scanScriptDependencies(
      "define('demo', [\n'N/record', './lib', '\\u004e/record'\n], () => ({}));",
    );
    expect(result.status).toBe('checked');
    expect(result.declarations[0]!.modules.map((module) => module.id)).toEqual([
      'N/record',
      './lib',
      'N/record',
    ]);
    expect(result.declarations[0]!.modules[0]).toMatchObject({ line: 2, column: 1 });
  });
  it('does not turn strings, comments, regexes, member calls or nested calls into declarations', () => {
    expect(
      scanScriptDependencies(`// define(['fake'], x)
      const text = "define(['fake'], x)";
      const regex = /define/;
      obj.define(['fake'], x);
      function demo() { define(['fake'], x); }
    `),
    ).toMatchObject({ status: 'not-checked', reason: 'no-define', declarations: [] });
  });
  it.each(['define([], () => ({}))', 'define(() => ({}))', "define('name', {value: 1})"])(
    'handles a declaration with no static imports: %s',
    (content) => {
      expect(scanScriptDependencies(content)).toMatchObject({
        status: 'checked',
        declarations: [{ modules: [] }],
      });
    },
  );
  it.each([
    'define(deps, x)',
    "define(['N/record', ...deps, `dynamic`, 'N/' + name], x)",
    "define([, 'N/record'], x)",
  ])('discloses incomplete dynamic definitions: %s', (content) => {
    expect(scanScriptDependencies(content)).toMatchObject({
      status: 'not-checked',
      reason: 'dynamic',
    });
  });
  it('bounds modules and declarations, and rejects oversized/malformed content', () => {
    const result = scanScriptDependencies(
      `define([${Array.from({ length: 201 }, () => "'N/record'").join(',')}], x)`,
    );
    expect(result).toMatchObject({ status: 'not-checked', reason: 'limit' });
    expect(result.declarations[0]!.modules).toHaveLength(DEPENDENCY_LIMITS.modules);
    expect(scanScriptDependencies('define([], x);'.repeat(21))).toMatchObject({ reason: 'limit' });
    expect(scanScriptDependencies(' '.repeat(REFERENCE_LIMITS.characters + 1))).toMatchObject({
      reason: 'limit',
    });
    expect(scanScriptDependencies('define([ broken')).toMatchObject({ reason: 'syntax' });
  });
  it('never executes parsed source', () => {
    expect(
      scanScriptDependencies("throw new Error('must not execute'); define(['N/record'], x)").status,
    ).toBe('checked');
  });
});
