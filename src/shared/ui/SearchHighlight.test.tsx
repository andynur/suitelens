import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SearchHighlight } from './SearchHighlight';

it('marks repeated literal matches while preserving case, escaped text and ID wrapping', () => {
  const text = '<script>Custbody_a.b_CUSTBODY_a.b</script>';
  const { container, rerender } = render(<SearchHighlight text={text} query=" a.b " breakIds />);
  expect(Array.from(container.querySelectorAll('mark'), (mark) => mark.textContent)).toEqual([
    'a.b',
    'a.b',
  ]);
  expect(container.textContent).toBe(text);
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelectorAll('wbr')).toHaveLength(3);
  rerender(<SearchHighlight text={text} query="   " breakIds />);
  expect(container.querySelector('mark')).toBeNull();
  expect(container.textContent).toBe(text);
});

it('keeps a match spanning underscore breaks intact and matches mixed case', () => {
  const { container } = render(<SearchHighlight text="custbody_waiver" query="BODY_WA" breakIds />);
  expect(container.querySelector('mark')).toHaveTextContent('body_wa');
  expect(container.querySelector('mark wbr')).not.toBeNull();
  expect(container.textContent).toBe('custbody_waiver');
});
