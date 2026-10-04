import { describe, expect, it } from 'vitest';
import { KNOWN_EXECUTION_CONTEXTS, summarizeContexts } from './contexts';

describe('summarizeContexts', () => {
  it('reads the full list as "all", including extra contexts from newer releases', () => {
    expect(summarizeContexts(KNOWN_EXECUTION_CONTEXTS)).toEqual({ kind: 'all' });
    expect(summarizeContexts([...KNOWN_EXECUTION_CONTEXTS, 'NEWCONTEXT'])).toEqual({ kind: 'all' });
  });

  it('names the few contexts missing from an almost-full list', () => {
    const contexts = KNOWN_EXECUTION_CONTEXTS.filter(
      (c) => c !== 'CSVIMPORT' && c !== 'WEBSERVICES',
    );
    expect(summarizeContexts(contexts)).toEqual({
      kind: 'allExcept',
      missing: ['CSVIMPORT', 'WEBSERVICES'],
    });
  });

  it('shows short lists as they are and folds long ones', () => {
    expect(summarizeContexts(['userinterface', ' CSVIMPORT', ''])).toEqual({
      kind: 'list',
      shown: ['USERINTERFACE', 'CSVIMPORT'],
      hidden: [],
    });
    const long = KNOWN_EXECUTION_CONTEXTS.slice(0, 10);
    const summary = summarizeContexts(long);
    expect(summary).toMatchObject({ kind: 'list', shown: long.slice(0, 6), hidden: long.slice(6) });
  });
});
