import { readFixture } from '../../test/fixtures';
import {
  buildContentIndex,
  ContentIndexSchema,
  INDEX_LIMITS,
  scanContentIndex,
} from './contentIndex';
import { scanReferences } from './references';

describe('hashed script content index', () => {
  it('matches direct scans across identifiers and stores no source tokens', async () => {
    const text = readFixture('impact-analysis/user-event.js');
    const index = await buildContentIndex(text, 123);
    expect(ContentIndexSchema.safeParse(index).success).toBe(true);
    for (const target of ['custbody_demo_flag', 'order', 'beforeSubmit', 'unknown']) {
      expect(await scanContentIndex(index, target)).toEqual(
        scanReferences(text, target, 'script', { includeExcerpts: false }),
      );
    }
    for (const forbidden of [
      'custbody',
      'getValue',
      'N/record',
      'define',
      'excerpt',
      'fake-secret',
    ])
      expect(JSON.stringify(index)).not.toContain(forbidden);
  });
  it.each(['\n', '\r\n', '\r'])(
    'preserves boundaries and dynamic prefixes with %j',
    async (newline) => {
      const text = [
        "'$custbody_demo' 'custbody_demo_more' 'custbody_demo'",
        "`custbody_${name}`; 'custbody_' + suffix; 42 142 script42",
      ].join(newline);
      const index = await buildContentIndex(text, 0);
      for (const target of ['custbody_demo', '42', 'custbody_', 'script42']) {
        expect(await scanContentIndex(index, target)).toEqual(
          scanReferences(text, target, 'script', { includeExcerpts: false }),
        );
      }
    },
  );
  it('discloses index truncation and per-target hit limits', async () => {
    const index = await buildContentIndex('demo '.repeat(INDEX_LIMITS.positions + 1), 0);
    expect(index.complete).toBe(false);
    expect(await scanContentIndex(index, 'missing')).toMatchObject({
      status: 'not-checked',
      reason: 'match-limit',
    });
    expect((await scanContentIndex(index, 'demo')).hits).toHaveLength(1000);
    expect(await scanContentIndex(index, '')).toMatchObject({ reason: 'invalid-target' });
  });
  it('rejects corrupt index shapes and detects changed content', async () => {
    const original = await buildContentIndex('demo', 0);
    const changed = await buildContentIndex('demo2', 0);
    expect(original.contentHash).not.toBe(changed.contentHash);
    expect(ContentIndexSchema.safeParse({ ...original, content: 'private' }).success).toBe(false);
    expect(
      ContentIndexSchema.safeParse({
        ...original,
        tokens: [...original.tokens, ...original.tokens],
      }).success,
    ).toBe(false);
  });
});
