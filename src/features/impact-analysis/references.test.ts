import { readFixture } from '../../test/fixtures';
import { REFERENCE_LIMITS, scanReferences } from './references';

describe('local impact reference candidates', () => {
  it('finds a UE field literal and dynamic prefix with source and precise positions', () => {
    const content = readFixture('impact-analysis/user-event.js');
    const result = scanReferences(content, 'custbody_demo_flag', 'script');
    expect(result.status).toBe('checked');
    expect(result.hits.map((hit) => [hit.source, hit.kind, hit.confidence, hit.line])).toEqual([
      ['script', 'exact-token', 'possible', 5],
      ['script', 'dynamic-prefix', 'possible', 7],
    ]);
    for (const hit of result.hits) {
      expect(content.slice(hit.offset, hit.offset + hit.length)).toBe(
        hit.kind === 'exact-token' ? 'custbody_demo_flag' : 'custbody_',
      );
      expect(hit.excerpt?.lines).toHaveLength(7);
    }
  });

  it('finds a PDF field expression without claiming semantic certainty', () => {
    const result = scanReferences(
      readFixture('impact-analysis/invoice-template.xml'),
      'custbody_demo_flag',
      'pdf-template',
    );
    expect(result.hits).toMatchObject([
      { source: 'pdf-template', confidence: 'possible', kind: 'exact-token', line: 5, column: 17 },
    ]);
    expect(result.coverage).toBe('text-only');
  });

  it('does not match a longer identifier or a case variant', () => {
    expect(
      scanReferences(
        'xcustbody_demo custbody_demo_more $custbody_demo CUSTBODY_DEMO',
        'custbody_demo',
        'script',
      ).hits,
    ).toEqual([]);
  });

  it('finds repeated exact tokens and numeric IDs at identifier boundaries', () => {
    expect(scanReferences("'42', 142, '42', script42", '42', 'script').hits).toHaveLength(2);
    expect(
      scanReferences("'customscript_demo' customscript_demo", 'customscript_demo', 'script').hits,
    ).toHaveLength(2);
  });

  it('keeps comments, regexes and quoted concatenations possible', () => {
    const result = scanReferences(
      "// custbody_demo\n/* custbody_demo */\n/custbody_demo/; 'custbody_demo' + suffix;",
      'custbody_demo',
      'script',
    );
    expect(result.hits).toHaveLength(4);
    expect(result.hits.every((hit) => hit.confidence === 'possible')).toBe(true);
  });

  it('finds possible interpolated and concatenated prefixes, never unrelated short prefixes', () => {
    const result = scanReferences(
      "`custbody_${suffix}`; `custbody_` + suffix; \"custbody_\" + suffix; 'cus' + suffix; 'custrecord_' + suffix;",
      'custbody_demo',
      'script',
    );
    expect(result.hits).toHaveLength(3);
    expect(result.hits.every((hit) => hit.kind === 'dynamic-prefix')).toBe(true);
    expect(scanReferences("'custbody_demo' + suffix", 'custbody_demo', 'script').hits).toHaveLength(
      1,
    );
  });

  it.each(['\n', '\r\n', '\r'])(
    'uses one-based locations and clipped excerpts for %j',
    (newline) => {
      const result = scanReferences(
        ['custbody_demo', 'a', '  custbody_demo'].join(newline),
        'custbody_demo',
        'script',
      );
      expect(result.hits.map((hit) => [hit.line, hit.column])).toEqual([
        [1, 1],
        [3, 3],
      ]);
      expect(result.hits[1]?.excerpt).toEqual({
        startLine: 1,
        lines: ['custbody_demo', 'a', '  custbody_demo'],
        truncated: false,
      });
    },
  );

  it('orders exact and dynamic hits by source position and supports omitting source excerpts', () => {
    const result = scanReferences("'custbody_' + x; 'custbody_demo'", 'custbody_demo', 'script', {
      includeExcerpts: false,
    });
    expect(result.hits.map((hit) => hit.kind)).toEqual(['dynamic-prefix', 'exact-token']);
    expect(result.hits.every((hit) => !('excerpt' in hit))).toBe(true);
  });

  it('bounds excerpts on minified lines and discloses truncation', () => {
    const result = scanReferences(' '.repeat(600) + 'custbody_demo', 'custbody_demo', 'script');
    expect(result.hits[0]?.column).toBe(601);
    expect(result.hits[0]?.excerpt?.truncated).toBe(true);
    expect(result.hits[0]?.excerpt?.lines[0]).toHaveLength(REFERENCE_LIMITS.excerptLineCharacters);
  });

  it.each(['', 'a.b', 'a b', 'a+', '0', '1'.repeat(129)])('rejects invalid target %j', (target) => {
    expect(scanReferences('anything', target, 'script')).toMatchObject({
      status: 'not-checked',
      reason: 'invalid-target',
      hits: [],
    });
  });

  it('reports empty text as checked text only', () => {
    expect(scanReferences('', 'custbody_demo', 'script')).toEqual({
      source: 'script',
      status: 'checked',
      hits: [],
      coverage: 'text-only',
    });
  });

  it('rejects oversized input without scanning a misleading partial prefix', () => {
    expect(
      scanReferences('x'.repeat(REFERENCE_LIMITS.characters + 1), 'x', 'script'),
    ).toMatchObject({ status: 'not-checked', reason: 'content-too-large', hits: [] });
  });

  it('caps results and explicitly marks incomplete coverage', () => {
    const result = scanReferences(
      'custbody_demo '.repeat(REFERENCE_LIMITS.hits + 1),
      'custbody_demo',
      'script',
      { includeExcerpts: false },
    );
    expect(result).toMatchObject({ status: 'not-checked', reason: 'match-limit' });
    expect(result.hits).toHaveLength(REFERENCE_LIMITS.hits);
    expect(
      scanReferences(
        "'custbody_' + x;".repeat(REFERENCE_LIMITS.hits + 1),
        'custbody_demo',
        'script',
        { includeExcerpts: false },
      ).reason,
    ).toBe('match-limit');
  });
});
